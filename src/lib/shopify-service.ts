import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

interface ShopifyMetrics {
  connected: boolean;
  metrics?: {
    gmv: number;
    orders: number;
    aov: number;
    conversionRate: number;
    salesTrend: Array<{ date: string; sales: number }>;
    topProducts: Array<{ id: number; name: string; sales: number; revenue: number }>;
  };
}

export async function getShopifyMetrics(userId: string): Promise<ShopifyMetrics> {
  try {
    // Get user's Shopify credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('shopify_credentials')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user?.shopify_credentials) {
      return { connected: false };
    }

    // For now, use mock domain since shopify_domain doesn't exist in DB yet
    // In production, you would get this from user.shopify_domain
    const mockDomain = 'your-store.myshopify.com';
    
    // Fetch orders from Shopify
    const ordersUrl = `https://${mockDomain}/admin/api/2024-07/orders.json`;
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': user.shopify_credentials,
        'Content-Type': 'application/json',
      },
      method: 'GET',
      // Add params for filtering
    });

    if (!ordersResponse.ok) {
      logger.error('Failed to fetch Shopify orders:', { status: ordersResponse.status });
      return { connected: false };
    }

    const ordersData = await ordersResponse.json();
    const orders = ordersData.orders || [];

    // Calculate metrics
    const gmv = orders.reduce((total: number, order: any) => total + parseFloat(order.total_price || 0), 0);
    const orderCount = orders.length;
    const aov = orderCount > 0 ? gmv / orderCount : 0;

    // Generate sales trend (last 7 days)
    const salesTrend = generateSalesTrend(orders);
    
    // Get top products (mock for now - would need to fetch products separately)
    const topProducts = [
      { id: 1, name: 'Premium Course Bundle', sales: 89, revenue: 5340 },
      { id: 2, name: 'Digital Marketing Guide', sales: 67, revenue: 2010 },
      { id: 3, name: 'Success Workbook', sales: 45, revenue: 1350 },
    ];

    return {
      connected: true,
      metrics: {
        gmv,
        orders: orderCount,
        aov,
        conversionRate: 3.2, // Mock value - would need analytics data
        salesTrend,
        topProducts,
      }
    };
  } catch (error) {
    logger.error('Error fetching Shopify metrics:', error);
    return { connected: false };
  }
}

function generateSalesTrend(orders: any[]): Array<{ date: string; sales: number }> {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  return last7Days.map(date => {
    const dailyOrders = orders.filter(order => 
      order.created_at && order.created_at.startsWith(date)
    );
    const dailySales = dailyOrders.reduce((total, order) => 
      total + parseFloat(order.total_price || 0), 0
    );
    
    return { date, sales: dailySales };
  });
}