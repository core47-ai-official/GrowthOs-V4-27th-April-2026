import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, CreditCard, Clock, Phone, Banknote, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrencySymbol as getCurrencySymbolUtil } from '@/utils/currencyFormatter';
import { ENV_CONFIG } from '@/lib/env-config';
import { logger } from '@/lib/logger';
interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}
interface PaywallModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceAmount?: number;
  invoiceNumber?: string;
}
export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onOpenChange,
  invoiceAmount,
  invoiceNumber
}) => {
  const {
    toast
  } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [currency, setCurrency] = useState(ENV_CONFIG.DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!isOpen) return;
    
    // Don't fetch anything if user is suspended
    const suspensionError = sessionStorage.getItem('suspension_error');
    if (suspensionError) return;
    
    fetchCompanySettings();
  }, [isOpen]);
  const fetchCompanySettings = async () => {
    try {
      // Check if user is authenticated before fetching
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const {
        data,
        error
      } = await supabase.from('company_settings').select('payment_methods, currency, company_name, contact_email, primary_phone').single();
      if (error) throw error;
      if (data) {
        const methods = data.payment_methods;
        if (Array.isArray(methods)) {
          setPaymentMethods(methods as unknown as PaymentMethod[]);
        }
        setCurrency(data.currency || ENV_CONFIG.DEFAULT_CURRENCY);
        setCompanyDetails(data);
      }
    } catch (error) {
      logger.error('Error fetching company settings:', error);
      
      // Don't show error toast for suspended users or auth/permission errors
      const suspensionError = sessionStorage.getItem('suspension_error');
      const status = (error as any)?.status ?? (error as any)?.code;
      const message = (error as any)?.message ?? "";
      const isAuthOrPermissionError = status === 401 || status === 403 || 
        /permission|auth|rls/i.test(message);
      
      if (!suspensionError && !isAuthOrPermissionError) {
        toast({
          title: "Error",
          description: "Failed to load payment information",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };
  const getCurrencySymbol = (curr?: string) => {
    return getCurrencySymbolUtil(curr || currency);
  };
  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'bank_transfer':
        return <Banknote className="h-5 w-5" />;
      case 'cod':
        return <DollarSign className="h-5 w-5" />;
      case 'stripe':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };
  const handleContactBilling = () => {
    const subject = encodeURIComponent(`Payment Proof for First Installment - ${invoiceNumber || 'Student Account'}`);
    const body = encodeURIComponent(`Hello,

I am writing to submit my payment proof for my first installment.

Invoice Number: ${invoiceNumber || 'Pending'}
Amount: ${getCurrencySymbol(currency)}${invoiceAmount?.toLocaleString() || '50,000'}

Please find my payment receipt attached.

Thank you,`);
    const contactEmail = companyDetails?.contact_email || 'gbilling@idmpaksitan.pk';
    window.open(`mailto:${contactEmail}?subject=${subject}&body=${body}`, '_blank');
  };
  const enabledPaymentMethods = paymentMethods.filter(method => method.enabled);
  return <Dialog open={isOpen} onOpenChange={onOpenChange} modal>
      
    </Dialog>;
};
