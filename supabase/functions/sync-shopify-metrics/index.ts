
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compute YYYY-MM-DD string in UTC
function toDateStr(d: Date): string {
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.split("T")[0];
}

// Build last 7 days array (UTC)
function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    ));
    d.setUTCDate(d.getUTCDate() - i);
    days.push(toDateStr(d));
  }
  return days;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: use the JWT from the Authorization header
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userInfo } = await supabase.auth.getUser(token);

    if (!userInfo?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userInfo.user.id;

    // 1) Try to read from the normalized integrations table
    const { data: integration, error: integError } = await supabase
      .from("integrations")
      .select("access_token, external_id")
      .eq("user_id", userId)
      .eq("source", "shopify")
      .maybeSingle();

    if (integError) {
      console.error("Integrations select error:", integError);
    }

    let tokenFromIntegrations = integration?.access_token || null;
    const domainFromIntegrations = integration?.external_id || null;

    // Decrypt if stored via encrypt-token (base64)
    if (tokenFromIntegrations) {
      try { tokenFromIntegrations = atob(tokenFromIntegrations); } catch (_) {}
    }

    // If we don't have both token and domain, gracefully no-op so we don't affect current behavior.
    if (!tokenFromIntegrations || !domainFromIntegrations) {
      // Do NOT try to fetch from legacy columns or make assumptions that could break current flows.
      // We exit gracefully.
      return new Response(
        JSON.stringify({
          success: true,
          connected: false,
          reason: "No Shopify integration configured in integrations table (access_token and/or domain missing).",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Fetch last 7 days of orders from Shopify (best effort, single page)
    const days = lastNDays(7);
    const createdAtMin = `${days[0]}T00:00:00Z`;
    const ordersUrl =
      `https://${domainFromIntegrations}/admin/api/2024-07/orders.json?status=any&fields=total_price,created_at&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`;

    const shopifyResp = await fetch(ordersUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": tokenFromIntegrations,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyResp.ok) {
      console.error("Shopify API error:", shopifyResp.status, await shopifyResp.text());
      return new Response(
        JSON.stringify({ success: false, error: `Shopify API error: ${shopifyResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ordersData = await shopifyResp.json();
    const orders = Array.isArray(ordersData?.orders) ? ordersData.orders : [];

    // 3) Aggregate daily metrics
    const byDate: Record<string, { gmv: number; orders: number }> = {};
    for (const d of days) {
      byDate[d] = { gmv: 0, orders: 0 };
    }

    for (const order of orders) {
      const created = (order?.created_at || "").toString();
      const day = created.split("T")[0];
      if (byDate[day]) {
        const price = parseFloat(order?.total_price || "0");
        byDate[day].gmv += isNaN(price) ? 0 : price;
        byDate[day].orders += 1;
      }
    }

    // 4) Upsert into user_metrics (two metrics per day: gmv, orders)
    const rows: Array<{
      user_id: string;
      source: string;
      metric: string;
      value: number;
      date: string;
    }> = [];

    for (const d of days) {
      rows.push(
        { user_id: userId, source: "shopify", metric: "gmv", value: byDate[d].gmv, date: d },
        { user_id: userId, source: "shopify", metric: "orders", value: byDate[d].orders, date: d },
      );
    }

    const { error: upsertError } = await supabase
      .from("user_metrics")
      .upsert(rows, { onConflict: "user_id,source,metric,date" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save metrics" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Summaries (non-persistent, just returned)
    const totalGmv = rows.filter(r => r.metric === "gmv").reduce((s, r) => s + r.value, 0);
    const totalOrders = rows.filter(r => r.metric === "orders").reduce((s, r) => s + r.value, 0);
    const aov = totalOrders > 0 ? totalGmv / totalOrders : 0;

    return new Response(
      JSON.stringify({
        success: true,
        connected: true,
        saved: rows.length,
        summary: { totalGmv, totalOrders, aov },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-shopify-metrics error:", err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
