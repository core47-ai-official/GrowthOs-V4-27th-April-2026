import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TEXT_CONTENT, DOMAIN_CONFIG } from '@/config/text-content';

interface AskShopDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainSave: (domain: string) => void;
}

export const AskShopDomainDialog = ({ open, onOpenChange, onDomainSave }: AskShopDomainDialogProps) => {
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState("");

  const handleShopDomainSave = () => {
    const domain = shopDomain.trim().toLowerCase();
    
    // Validate domain format
    if (!domain) {
      toast({
        title: "Error",
        description: "Please enter your shop domain.",
        variant: "destructive",
      });
      return;
    }

    // Normalize domain
    let normalizedDomain = domain;
    if (!normalizedDomain.includes('.')) {
      normalizedDomain += DOMAIN_CONFIG.SHOPIFY_SUFFIX;
    }

    // Validate format
    if (!DOMAIN_CONFIG.isValidShopifyDomain(normalizedDomain)) {
      toast({
        title: "Invalid Domain",
        description: `Domain must be in format: ${TEXT_CONTENT.PLACEHOLDER_SHOPIFY_DOMAIN}`,
        variant: "destructive",
      });
      return;
    }

    onDomainSave(normalizedDomain);
    setShopDomain("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Your Shop Domain</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="shop-domain">Shop Domain</Label>
            <Input
              id="shop-domain"
              placeholder={TEXT_CONTENT.PLACEHOLDER_SHOPIFY_DOMAIN}
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleShopDomainSave()}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use your {DOMAIN_CONFIG.SHOPIFY_SUFFIX} domain (e.g., {TEXT_CONTENT.PLACEHOLDER_SHOPIFY_DOMAIN}). Do not use your custom domain.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleShopDomainSave} 
              className="flex-1"
              disabled={!shopDomain.trim()}
            >
              Save
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};