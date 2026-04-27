import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Settings2, ChevronDown, ChevronUp, BadgePercent, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null;
  onStudentUpdated: () => void;
}

interface EnrollmentData {
  id: string;
  course_id: string | null;
  pathway_id: string | null;
  drip_override: boolean;
  drip_enabled: boolean | null;
  sequential_override: boolean;
  sequential_enabled: boolean | null;
  discount_amount: number | null;
  discount_percentage: number | null;
  total_amount: number | null;
  course?: { title: string; price: number | null } | null;
  pathway?: { name: string; price: number | null } | null;
}

export const EditStudentDialog = ({ open, onOpenChange, student, onStudentUpdated }: EditStudentDialogProps) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canApplyDiscount = hasRole(['admin', 'superadmin']);
  
  // Access settings state
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false);
  const [discountSettingsOpen, setDiscountSettingsOpen] = useState(false);
  const [dripOverride, setDripOverride] = useState(false);
  const [dripEnabled, setDripEnabled] = useState(false);
  const [sequentialOverride, setSequentialOverride] = useState(false);
  const [sequentialEnabled, setSequentialEnabled] = useState(false);
  
  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [originalPrice, setOriginalPrice] = useState(0);
  
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [hasEnrollmentChanges, setHasEnrollmentChanges] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Fetch company settings for currency
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('currency')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-edit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, start_date')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
  
  const currency = companySettings?.currency || 'PKR';

  // Fetch enrollment data when student changes
  useEffect(() => {
    if (student && open) {
      // Reset basic info
      setFullName(student.full_name);
      setEmail(student.email);
      setPhone(student.phone || '');
      
      // Fetch enrollment data
      const fetchEnrollment = async () => {
        // First get the student record to find student_id
        const { data: studentRecord } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', student.id)
          .single();
        
        if (!studentRecord) return;
        
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select(`
            id,
            course_id,
            pathway_id,
            batch_id,
            drip_override,
            drip_enabled,
            sequential_override,
            sequential_enabled,
            discount_amount,
            discount_percentage,
            total_amount,
            courses:course_id (title, price),
            learning_pathways:pathway_id (name, price)
          `)
          .eq('student_id', studentRecord.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (enrollment) {
          setEnrollmentId(enrollment.id);
          setBatchId(enrollment.batch_id || null);
          setDripOverride(enrollment.drip_override || false);
          setDripEnabled(enrollment.drip_enabled || false);
          setSequentialOverride(enrollment.sequential_override || false);
          setSequentialEnabled(enrollment.sequential_enabled || false);
          
          // Handle discount
          const courses = enrollment.courses as { title: string; price: number | null } | null;
          const pathways = enrollment.learning_pathways as { name: string; price: number | null } | null;
          const price = courses?.price || pathways?.price || 0;
          setOriginalPrice(price);
          
          if (enrollment.discount_percentage && enrollment.discount_percentage > 0) {
            setDiscountType('percentage');
            setDiscountPercentage(enrollment.discount_percentage);
            setDiscountAmount(0);
          } else if (enrollment.discount_amount && enrollment.discount_amount > 0) {
            setDiscountType('fixed');
            setDiscountAmount(enrollment.discount_amount);
            setDiscountPercentage(0);
          } else {
            setDiscountType('none');
            setDiscountAmount(0);
            setDiscountPercentage(0);
          }
        }
      };
      
      fetchEnrollment();
    }
  }, [student, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!student) return;
    
    setLoading(true);
    
    try {
      const emailChanged = email !== student.email;
      
      // Call edge function to update student details
      const { data, error } = await supabase.functions.invoke('update-student-details', {
        body: {
          user_id: student.id,
          full_name: fullName,
          email: email,
          phone: phone,
          resend_credentials: emailChanged,
          // Access settings
          enrollment_id: enrollmentId,
          batch_id: batchId,
          drip_override: dripOverride,
          drip_enabled: dripOverride ? dripEnabled : null,
          sequential_override: sequentialOverride,
          sequential_enabled: sequentialOverride ? sequentialEnabled : null,
          // Discount settings
          discount_type: discountType,
          discount_amount: discountType === 'fixed' ? discountAmount : 0,
          discount_percentage: discountType === 'percentage' ? discountPercentage : 0
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('Update result:', data);

      // Check if email was sent and handle different scenarios
      if (emailChanged && data?.email_sent) {
        if (data?.password_regenerated) {
          toast({
            title: 'Student Updated & Password Reset',
            description: 'Student details updated successfully. A new password was generated and login credentials have been sent to their new email address.',
          });
        } else {
          toast({
            title: 'Success',
            description: 'Student details updated and login credentials sent to new email'
          });
        }
      } else if (emailChanged && !data?.email_sent && data?.email_error) {
        console.error('Email sending failed:', data.email_error);
        toast({
          title: 'Partially Updated',
          description: `Student updated but email failed: ${data.email_error}`,
          variant: 'destructive'
        });
      } else if (emailChanged && !data?.email_sent) {
        console.warn('Email not sent - SMTP may not be configured');
        toast({
          title: 'Partially Updated',
          description: 'Student updated but credentials email not sent (SMTP not configured)',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Student details updated successfully'
        });
      }

      onStudentUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update student details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate final amount with discount
  const calculatedAmounts = (() => {
    let finalAmount = originalPrice;
    let discountApplied = 0;

    if (discountType === 'percentage' && discountPercentage > 0) {
      discountApplied = originalPrice * (discountPercentage / 100);
      finalAmount = originalPrice - discountApplied;
    } else if (discountType === 'fixed' && discountAmount > 0) {
      discountApplied = discountAmount;
      finalAmount = originalPrice - discountApplied;
    }

    finalAmount = Math.max(0, finalAmount);

    return {
      originalFee: originalPrice,
      discountApplied,
      finalAmount
    };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student Details</DialogTitle>
          <DialogDescription>
            Update student information. If email is changed, login credentials will be resent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            {/* Batch Assignment */}
            {batches.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Batch Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label>Select Batch</Label>
                  <Select
                    value={batchId || "none"}
                    onValueChange={(value) => setBatchId(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a batch" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="none">No Batch (Use LMS Access Date)</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name} (Start: {new Date(batch.start_date).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When a batch is assigned, content drip schedule is calculated from the batch start date.
                  </p>
                </CardContent>
              </Card>
            )}

            {canApplyDiscount && enrollmentId && (
              <Collapsible open={accessSettingsOpen} onOpenChange={setAccessSettingsOpen}>
                <Card className="border-blue-200 bg-blue-50/50">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-blue-100/50 transition-colors">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Access Settings
                        </span>
                        {accessSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <p className="text-xs text-muted-foreground">
                        Override company/course settings for this specific student.
                      </p>
                      
                      {/* Content Dripping Override */}
                      <div className="space-y-3 p-3 rounded-lg border border-blue-200 bg-white/50">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="drip-override-edit" className="flex flex-col">
                            <span>Override Content Dripping</span>
                            <span className="font-normal text-xs text-muted-foreground">
                              Control when recordings become available
                            </span>
                          </Label>
                          <Switch
                            id="drip-override-edit"
                            checked={dripOverride}
                            onCheckedChange={setDripOverride}
                          />
                        </div>
                        
                        {dripOverride && (
                          <RadioGroup
                            value={dripEnabled ? 'enabled' : 'disabled'}
                            onValueChange={(value) => setDripEnabled(value === 'enabled')}
                            className="pl-4 space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="disabled" id="drip-disabled-edit" />
                              <Label htmlFor="drip-disabled-edit" className="font-normal cursor-pointer">
                                Disable dripping (all content available immediately)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="enabled" id="drip-enabled-edit" />
                              <Label htmlFor="drip-enabled-edit" className="font-normal cursor-pointer">
                                Enable dripping (content unlocks over time)
                              </Label>
                            </div>
                          </RadioGroup>
                        )}
                      </div>
                      
                      {/* Sequential Unlock Override */}
                      <div className="space-y-3 p-3 rounded-lg border border-blue-200 bg-white/50">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sequential-override-edit" className="flex flex-col">
                            <span>Override Sequential Unlock</span>
                            <span className="font-normal text-xs text-muted-foreground">
                              Control whether recordings must be watched in order
                            </span>
                          </Label>
                          <Switch
                            id="sequential-override-edit"
                            checked={sequentialOverride}
                            onCheckedChange={setSequentialOverride}
                          />
                        </div>
                        
                        {sequentialOverride && (
                          <RadioGroup
                            value={sequentialEnabled ? 'enabled' : 'disabled'}
                            onValueChange={(value) => setSequentialEnabled(value === 'enabled')}
                            className="pl-4 space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="disabled" id="sequential-disabled-edit" />
                              <Label htmlFor="sequential-disabled-edit" className="font-normal cursor-pointer">
                                Disable sequential unlock (watch any recording)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="enabled" id="sequential-enabled-edit" />
                              <Label htmlFor="sequential-enabled-edit" className="font-normal cursor-pointer">
                                Enable sequential unlock (must watch in order)
                              </Label>
                            </div>
                          </RadioGroup>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Discount Settings Section (Admin Only) */}
            {canApplyDiscount && enrollmentId && originalPrice > 0 && (
              <Collapsible open={discountSettingsOpen} onOpenChange={setDiscountSettingsOpen}>
                <Card className="border-orange-200 bg-orange-50/50">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-orange-100/50 transition-colors">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <BadgePercent className="h-4 w-4" />
                          Discount Settings
                        </span>
                        {discountSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Discount Type</Label>
                          <Select
                            value={discountType}
                            onValueChange={(value: 'none' | 'fixed' | 'percentage') => {
                              setDiscountType(value);
                              setDiscountAmount(0);
                              setDiscountPercentage(0);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Discount</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {discountType === 'fixed' && (
                          <div className="space-y-2">
                            <Label>Discount Amount ({currency})</Label>
                            <Input
                              type="number"
                              min="0"
                              max={originalPrice}
                              step="0.01"
                              value={discountAmount}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setDiscountAmount(Math.min(originalPrice, Math.max(0, value)));
                              }}
                              placeholder="0.00"
                            />
                          </div>
                        )}

                        {discountType === 'percentage' && (
                          <div className="space-y-2">
                            <Label>Discount Percentage (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={discountPercentage}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setDiscountPercentage(Math.min(100, Math.max(0, value)));
                              }}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </div>

                      {discountType !== 'none' && (
                        <div className="pt-2 space-y-1 border-t border-orange-200">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Original Fee:</span>
                            <span className="font-medium">{currency} {calculatedAmounts.originalFee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm text-orange-600">
                            <span>Discount:</span>
                            <span className="font-medium">- {currency} {calculatedAmounts.discountApplied.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-base font-semibold border-t border-orange-200 pt-1">
                            <span>Final Fee:</span>
                            <span>{currency} {calculatedAmounts.finalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        Note: Changing the discount will update the enrollment but won't automatically recalculate existing invoices.
                      </p>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};