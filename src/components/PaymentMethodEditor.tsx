import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Minus } from 'lucide-react';

interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}

interface PaymentMethodEditorProps {
  method: PaymentMethod;
  onUpdate: (updatedMethod: PaymentMethod) => void;
  onDelete: () => void;
}

const PaymentMethodEditor: React.FC<PaymentMethodEditorProps> = ({
  method,
  onUpdate,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateMethod = (updates: Partial<PaymentMethod>) => {
    onUpdate({ ...method, ...updates });
  };

  const updateDetail = (key: string, value: string) => {
    const updatedDetails = { ...method.details };
    if (value.trim() === '') {
      delete updatedDetails[key];
    } else {
      updatedDetails[key] = value;
    }
    updateMethod({ details: updatedDetails });
  };

  const addCustomDetail = () => {
    const key = `custom_field_${Date.now()}`;
    updateDetail(key, '');
  };

  const removeDetail = (key: string) => {
    const updatedDetails = { ...method.details };
    delete updatedDetails[key];
    updateMethod({ details: updatedDetails });
  };

  const getDefaultDetailsForType = (type: string) => {
    switch (type) {
      case 'bank_transfer':
        return ['Bank Name', 'Account Number', 'Routing Number', 'Account Holder'];
      case 'cod':
        return ['Instructions', 'Contact Phone', 'Collection Notes'];
      case 'stripe':
        return ['Account ID', 'Webhook URL', 'Instructions'];
      default:
        return [];
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'cod':
        return 'Cash on Delivery (COD)';
      case 'stripe':
        return 'Stripe Payment';
      case 'custom':
        return 'Custom Payment Method';
      default:
        return type;
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with method name and controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={method.enabled}
                onCheckedChange={(enabled) => updateMethod({ enabled })}
              />
              <div>
                <h4 className="font-medium">{method.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {getPaymentTypeLabel(method.type)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Collapse' : 'Configure'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Expanded configuration */}
          {isExpanded && (
            <div className="space-y-4 border-t pt-4">
              {/* Basic Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method Type</Label>
                  <Select
                    value={method.type}
                    onValueChange={(type: any) => updateMethod({ type })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                      <SelectItem value="stripe">Stripe Payment</SelectItem>
                      <SelectItem value="custom">Custom Payment Method</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={method.name}
                    onChange={(e) => updateMethod({ name: e.target.value })}
                    placeholder="Enter display name"
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Payment Details</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomDetail}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                {/* Default fields for payment type */}
                {getDefaultDetailsForType(method.type).map((fieldName) => {
                  const key = fieldName.toLowerCase().replace(/\s+/g, '_');
                  return (
                    <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label className="text-sm">{fieldName}</Label>
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          value={method.details[key] || ''}
                          onChange={(e) => updateDetail(key, e.target.value)}
                          placeholder={`Enter ${fieldName.toLowerCase()}`}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Custom fields */}
                {Object.entries(method.details).map(([key, value]) => {
                  // Skip default fields
                  const defaultFields = getDefaultDetailsForType(method.type)
                    .map(f => f.toLowerCase().replace(/\s+/g, '_'));
                  
                  if (defaultFields.includes(key)) return null;

                  return (
                    <div key={key} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div>
                        <Input
                          value={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          onChange={(e) => {
                            const newKey = e.target.value.toLowerCase().replace(/\s+/g, '_');
                            removeDetail(key);
                            updateDetail(newKey, value);
                          }}
                          placeholder="Field name"
                          className="text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          value={value}
                          onChange={(e) => updateDetail(key, e.target.value)}
                          placeholder="Enter value"
                        />
                      </div>
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDetail(key)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {Object.keys(method.details).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No payment details configured. Click "Add Field" to add custom details.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodEditor;