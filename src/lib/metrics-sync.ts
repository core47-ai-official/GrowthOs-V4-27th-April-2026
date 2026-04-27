
import { supabase } from "@/integrations/supabase/client";

export async function syncShopifyMetrics() {
  // Optional helper for manual invocation; not used by any UI.
  const { data, error } = await supabase.functions.invoke("sync-shopify-metrics");
  if (error) {
    console.error("syncShopifyMetrics error:", error);
    throw error;
  }
  return data;
}
