import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeLogger } from '@/lib/safe-logger';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Edit, Settings, Trash2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AskShopDomainDialog } from "./AskShopDomainDialog";
import { StudentIntegrations, encryptToken } from "@/lib/student-integrations";
import { supabase } from "@/integrations/supabase/client";
import { syncShopifyMetrics } from "@/lib/metrics-sync";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Small green live indicator dot
const LiveIndicator = () => (
  <span className="relative inline-flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
  </span>
);

interface ConnectAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onConnectionUpdate?: () => void;
}

export const ConnectAccountsDialog = ({ open, onOpenChange, userId, onConnectionUpdate }: ConnectAccountsDialogProps) => {
  const { toast } = useToast();
  const [metaConnected, setMetaConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editingShopify, setEditingShopify] = useState(false);
  const [metaKey, setMetaKey] = useState("");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [shopTokenInput, setShopTokenInput] = useState("");
  const [askDomainOpen, setAskDomainOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState("");
  const [integration, setIntegration] = useState<any>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);

  // Load existing integration settings
  useEffect(() => {
    const loadIntegrations = async () => {
      if (userId && open) {
        // Reset editing states and clear input fields when dialog opens
        setEditingMeta(false);
        setEditingShopify(false);
        setMetaKey("");
        setShopTokenInput("");
        
          try {
            const integrationData = await StudentIntegrations.get(userId);
            setIntegration(integrationData);

            // Load persisted Shopify domain from normalized integrations table
            try {
              const { data: shopifyInt, error: intErr } = await supabase
                .from('integrations')
                .select('external_id')
                .eq('user_id', userId)
                .eq('source', 'shopify')
                .maybeSingle();
              if (intErr) console.warn('Failed to load Shopify integration domain', intErr);
              setShopDomain(shopifyInt?.external_id || null);
            } catch (e) {
              console.warn('Error loading Shopify domain', e);
              setShopDomain(null);
            }
            
            if (integrationData) {
              setShopifyConnected(integrationData.is_shopify_connected);
              setMetaConnected(integrationData.is_meta_connected);
            } else {
              setShopifyConnected(false);
              setMetaConnected(false);
            }
          } catch (error) {
            console.error('Error loading integrations:', error);
          }
      }
    };

    loadIntegrations();
  }, [userId, open]);

  const handleShopifyToken = async () => {
    const token = shopTokenInput.trim();
    
    if (!token.startsWith('shpat_')) {
      toast({
        title: "Invalid Token",
        description: "Please enter a valid Shopify API access token (starts with shpat_).",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    // Check if we already have a shop domain stored
    if (shopDomain) {
      await completeShopifyConnection(token, shopDomain);
    } else {
      // Need to ask for domain
      setCurrentToken(token);
      setAskDomainOpen(true);
    }
  };

  const handleShopDomainSave = async (domain: string) => {
    safeLogger.info('Saving Shopify domain', { domain, userId });
    
    // If we have a token in memory (user just entered it), complete full connection
    if (currentToken) {
      await completeShopifyConnection(currentToken, domain);
      setCurrentToken("");
      return;
    }

    // Otherwise, persist only the domain using the existing saved token
    try {
      if (!userId) return;

      // Store domain in localStorage as backup
      try {
        localStorage.setItem(`shopify_domain_${userId}`, domain);
        safeLogger.debug('Domain stored in localStorage as backup');
      } catch (e) {
        console.warn('Could not store domain in localStorage:', e);
      }

      // Try to find existing integrations row
      const { data: existing } = await supabase
        .from('integrations')
        .select('id, access_token')
        .eq('user_id', userId)
        .eq('source', 'shopify')
        .maybeSingle();

      if (existing?.id) {
        safeLogger.info('Updating existing integrations row with domain');
        const { error: updateError } = await supabase
          .from('integrations')
          .update({ external_id: domain, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
          
        if (updateError) {
          console.error('Failed to update integrations row:', updateError);
          throw updateError;
        }
      } else {
        // Fall back to legacy saved token on users table via StudentIntegrations.get()
        safeLogger.info('No existing integrations row, creating new one with legacy token');
        const token = integration?.shopify_api_token;
        if (!token) {
          // Try to get from users table directly
          const { data: userData } = await supabase
            .from('users')
            .select('shopify_credentials')
            .eq('id', userId)
            .maybeSingle();
            
          if (!userData?.shopify_credentials) {
            toast({
              title: 'Missing token',
              description: 'We could not find your saved Shopify token. Please re-enter it.',
              variant: 'destructive',
            });
            return;
          }
          
          safeLogger.info('Creating integrations row with legacy credentials from users table');
          const { error: insertError } = await supabase.from('integrations').insert({
            user_id: userId,
            source: 'shopify',
            access_token: userData.shopify_credentials,
            external_id: domain,
          });
          
          if (insertError) {
            console.error('Failed to create integrations row:', insertError);
            throw insertError;
          }
        } else {
          safeLogger.info('Creating integrations row with token from StudentIntegrations');
          const { error: insertError } = await supabase.from('integrations').insert({
            user_id: userId,
            source: 'shopify',
            access_token: token,
            external_id: domain,
          });
          
          if (insertError) {
            console.error('Failed to create integrations row:', insertError);
            throw insertError;
          }
        }
      }

      // Verify the save worked
      const { data: verification } = await supabase
        .from('integrations')
        .select('external_id')
        .eq('user_id', userId)
        .eq('source', 'shopify')
        .maybeSingle();
        
      if (verification?.external_id !== domain) {
        console.error('Domain verification failed:', verification);
        throw new Error('Domain was not saved properly');
      }

      safeLogger.info('Domain successfully saved and verified');
      setShopDomain(domain);
      setShopifyConnected(true);
      if (onConnectionUpdate) onConnectionUpdate();
      if ((window as any).checkIntegrations) (window as any).checkIntegrations();
      toast({ title: 'Domain saved', description: 'Your Shopify domain has been added successfully.' });
    } catch (e) {
      console.error('Failed to save Shopify domain:', e);
      toast({ 
        title: 'Error', 
        description: `Could not save domain: ${e.message}. Please try again.`, 
        variant: 'destructive' 
      });
    }
  };
  const completeShopifyConnection = async (token: string, domain: string) => {
    try {
      // Validate on server (avoids CORS and gives clearer errors)
      const { data: validation, error: valError } = await supabase.functions.invoke('validate-shopify', {
        body: { shopifyDomain: domain, apiKey: token }
      });

      if (valError || !validation?.valid) {
        console.error('Shopify validation error:', valError || validation);
        toast({
          title: "Connection Failed",
          description: `${valError?.message || validation?.error || 'Could not verify your Shopify token/domain.'} If you used a custom domain, try your myshopify.com domain like yourstore.myshopify.com and ensure the token starts with shpat_.`,
          variant: "destructive",
        });
        return;
      }

      // Encrypt token and save
      const encryptedToken = await encryptToken(token);
      
      await StudentIntegrations.upsert({
        userId,
        shopify_api_token: encryptedToken,
        shop_domain: domain,
        is_shopify_connected: true
      });

      // Mirror into normalized integrations table for analytics/sync
      try {
        const { data: existing } = await supabase
          .from('integrations')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'shopify')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('integrations')
            .update({
              access_token: encryptedToken,
              external_id: domain,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('integrations')
            .insert({
              user_id: userId,
              source: 'shopify',
              access_token: encryptedToken,
              external_id: domain,
            });
        }
      } catch (e) {
        console.error('Failed to persist to integrations table:', e);
      }

      setShopifyConnected(true);
      setEditingShopify(false);
      setShopTokenInput("");
      setShopDomain(domain);

      // Kick off a background sync for last 7 days (non-blocking)
      try {
        syncShopifyMetrics().catch((err) => console.warn('syncShopifyMetrics failed', err));
      } catch (_) {}
      
      
      // Update navigation
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      // Notify integration listeners
      window.dispatchEvent(new CustomEvent('integrations-updated'));
      
      toast({
        title: "Shopify connected 🎉",
        description: "Your Shopify store has been successfully connected.",
      });
      
    } catch (error) {
      console.error('Error connecting Shopify:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Shopify account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShopifyDisconnect = async () => {
    try {
      await StudentIntegrations.disconnect(userId!, 'shopify');

      // Also remove from normalized integrations table
      try {
        await supabase
          .from('integrations')
          .delete()
          .eq('user_id', userId!)
          .eq('source', 'shopify');
      } catch (e) {
        console.error('Failed to clean integrations row for Shopify:', e);
      }

      setShopifyConnected(false);
      setShopDomain(null);
      
      if (onConnectionUpdate) {
        onConnectionUpdate();
      }
      
      window.dispatchEvent(new CustomEvent('integrations-updated'));
      
      toast({
        title: "Shopify Disconnected",
        description: "Your Shopify store has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting Shopify:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Shopify. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMetaConnect = async () => {
    if (!metaKey.trim() || !metaAccountId.trim()) {
      toast({
        title: "Missing Info",
        description: "Please enter both the Meta API token and Ad Account ID.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const encryptedToken = await encryptToken(metaKey);

      await StudentIntegrations.upsert({
        userId,
        meta_api_token: encryptedToken,
        is_meta_connected: true
      });

      // Mirror into normalized integrations table
      try {
        const accountId = metaAccountId.trim().startsWith('act_')
          ? metaAccountId.trim().slice(4)
          : metaAccountId.trim();

        const { data: existing } = await supabase
          .from('integrations')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'meta_ads')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('integrations')
            .update({
              access_token: encryptedToken,
              external_id: accountId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('integrations')
            .insert({
              user_id: userId,
              source: 'meta_ads',
              access_token: encryptedToken,
              external_id: accountId,
            });
        }
      } catch (e) {
        console.error('Failed to persist Meta integration:', e);
      }

      setMetaConnected(true);
      setEditingMeta(false);
      setMetaKey("");

      if (onConnectionUpdate) {
        onConnectionUpdate();
      }

      window.dispatchEvent(new CustomEvent('integrations-updated'));

      toast({
        title: "Meta API Connected",
        description: "Your Meta Ads account has been successfully connected.",
      });
    } catch (error) {
      console.error('Error saving Meta credentials:', error);
      toast({
        title: "Error",
        description: "Failed to save Meta credentials. Please try again.",
        variant: "destructive",
      });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Connect Your Accounts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Meta API Connection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Meta Ads API
                {metaConnected && !editingMeta && (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <LiveIndicator />
                    <Check className="w-3 h-3" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!metaConnected || editingMeta) && (
                <>
                  <div className="mb-2 p-2 bg-primary/5 border border-primary/10 rounded text-xs text-muted-foreground">
                    <p className="font-medium text-primary mb-1">Required Permissions:</p>
                    <ul className="space-y-0.5 ml-4">
                      <li>• ads_read</li>
                      <li>• ads_management</li>
                    </ul>
                    <p className="mt-2 text-xs">
                      The token must belong to a user or system user with access to the ad account (same Business Manager).
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="meta-key" className="text-xs">
                      Meta API Access Token
                    </Label>
                    <Input
                      id="meta-key"
                      type="password"
                      placeholder="Enter your Meta API access token"
                      value={metaKey}
                      onChange={(e) => setMetaKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="meta-account" className="text-xs">
                      Meta Ad Account ID
                    </Label>
                    <Input
                      id="meta-account"
                      type="text"
                      placeholder="act_1234567890 or 1234567890"
                      value={metaAccountId}
                      onChange={(e) => setMetaAccountId(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleMetaConnect} 
                    size="sm" 
                    className="w-full"
                    disabled={!metaKey.trim() || !metaAccountId.trim()}
                  >
                    {editingMeta ? "Update Connection" : "Connect Meta API"}
                  </Button>
                </>
              )}
              {metaConnected && !editingMeta && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditingMeta(true)}
                  className="w-full"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Connection
                </Button>
              )}
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground py-2">
                  <span>Where to get these credentials</span>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                  <div>
                    <p className="font-medium">Meta Ads access token</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Go to Meta for Developers → My Apps and create or open your app.</li>
                      <li>Add the Marketing API and generate a System User or User token.</li>
                      <li>Include scopes: ads_read and ads_management.</li>
                      <li>Copy the access token and paste it above.</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium">Ad Account ID</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Open Ads Manager and check the URL or account dropdown.</li>
                      <li>Use the numeric ID (e.g., 1234567890). "act_1234567890" also works.</li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Shopify Connection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                Shopify Store
                {shopifyConnected && !editingShopify && (
                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                    <LiveIndicator />
                    <Check className="w-3 h-3" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!shopifyConnected || editingShopify) && (
                <>
                  <div>
                    <Label htmlFor="shopify-token" className="text-xs">
                      Shopify API Access Token
                    </Label>
                    <Input
                      id="shopify-token"
                      type="password"
                      placeholder="shpat_"
                      value={shopTokenInput}
                      onChange={(e) => setShopTokenInput(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleShopifyToken} 
                    size="sm" 
                    className="w-full"
                    disabled={!shopTokenInput.trim()}
                  >
                    {editingShopify ? "Update Connection" : "Connect Shopify"}
                  </Button>
                </>
              )}
              {shopifyConnected && !editingShopify && (
                <div className="space-y-2">
                  {!shopDomain && (
                    <div className="p-3 border rounded-md text-xs text-yellow-900 bg-yellow-50">
                      <div className="flex items-center justify-between gap-2">
                        <span>Store domain missing. Add your yourstore.myshopify.com to finish setup.</span>
                        <Button size="sm" onClick={() => setAskDomainOpen(true)}>Add Store Domain</Button>
                      </div>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditingShopify(true)}
                    className="w-full"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Connection
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleShopifyDisconnect}
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              )}
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground py-2">
                  <span>Where to get these credentials</span>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-2">
                  <div>
                    <p className="font-medium">Admin API access token</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Shopify Admin → Settings → Apps and sales channels → Develop apps.</li>
                      <li>Create or open your app and enable Admin API scopes (e.g., read_orders, read_products).</li>
                      <li>Install the app, then reveal and copy the Admin API access token (starts with shpat_).</li>
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium">Shop domain</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Use your store domain like store-name.myshopify.com.</li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>

        {/* Ask Shop Domain Dialog */}
        <AskShopDomainDialog
          open={askDomainOpen}
          onOpenChange={setAskDomainOpen}
          onDomainSave={handleShopDomainSave}
        />
      </DialogContent>
    </Dialog>
  );
};