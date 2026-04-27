import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ConnectAccountsDialog } from '@/components/ConnectAccountsDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Target, Check, Plus } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

// Small green live indicator dot
const LiveIndicator = () => (
  <span className="relative inline-flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
  </span>
);

const Connect = () => {
  const { user, refreshUser } = useAuth();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('source, access_token')
          .eq('user_id', user.id);
        if (error) throw error;
        setShopifyConnected(!!data?.some((r: any) => r.source === 'shopify' && r.access_token));
        setMetaConnected(!!data?.some((r: any) => r.source === 'meta_ads' && r.access_token));
      } catch {
        setShopifyConnected(!!(user as any)?.shopify_credentials);
        setMetaConnected(!!(user as any)?.meta_ads_credentials);
      }
    };
    check();
    (window as any).checkIntegrations = check;
    return () => { if ((window as any).checkIntegrations) delete (window as any).checkIntegrations; };
  }, [user?.id]);

  const hasShopifyConnection = shopifyConnected;
  const hasMetaConnection = metaConnected;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">Connect Your Accounts</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Connect your Shopify store and Meta Ads account to unlock powerful analytics and insights. 
          Track your store performance and advertising metrics all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shopify Integration Card */}
        <Card className="relative">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShoppingBag className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Shopify Store</CardTitle>
                  <CardDescription>E-commerce analytics and sales data</CardDescription>
                </div>
              </div>
{hasShopifyConnection && (
                <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                  <LiveIndicator />
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">What you'll get:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time sales analytics</li>
                <li>• Product performance metrics</li>
                <li>• Customer behavior insights</li>
                <li>• Revenue tracking</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => setConnectModalOpen(true)}
              className="w-full"
              variant={hasShopifyConnection ? "outline" : "default"}
            >
              {hasShopifyConnection ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Manage Connection
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Shopify
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Meta Ads Integration Card */}
        <Card className="relative">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Meta Ads</CardTitle>
                  <CardDescription>Facebook & Instagram advertising metrics</CardDescription>
                </div>
              </div>
{hasMetaConnection && (
                <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                  <LiveIndicator />
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">What you'll get:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Campaign performance data</li>
                <li>• Ad spend and ROI tracking</li>
                <li>• Audience insights</li>
                <li>• Conversion metrics</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => setConnectModalOpen(true)}
              className="w-full"
              variant={hasMetaConnection ? "outline" : "default"}
            >
              {hasMetaConnection ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Manage Connection
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Meta Ads
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      {(hasShopifyConnection || hasMetaConnection) && (
        <Card>
          <CardHeader>
            <CardTitle>Your Connected Accounts</CardTitle>
            <CardDescription>Manage your integrated services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasShopifyConnection && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Shopify Store</p>
                      <p className="text-sm text-muted-foreground">Connected and syncing</p>
                    </div>
                  </div>
<Badge className="bg-green-100 text-green-800 flex items-center gap-1"><LiveIndicator /> Active</Badge>
                </div>
              )}
              
              {hasMetaConnection && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Target className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Meta Ads</p>
                      <p className="text-sm text-muted-foreground">Connected and syncing</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><LiveIndicator /> Active</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect Accounts Modal */}
      <ConnectAccountsDialog 
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        userId={user?.id}
        onConnectionUpdate={() => {
          // Refresh user data to update connection status
          refreshUser();
        }}
      />
    </div>
  );
};

export default Connect;