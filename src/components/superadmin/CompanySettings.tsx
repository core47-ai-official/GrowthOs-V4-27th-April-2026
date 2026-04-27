import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Phone, DollarSign, Settings, FileText, Calendar, HelpCircle, Plus, Trash2, Edit3, GripVertical, Eye, Mail, Send, BookOpen, Clock, Megaphone, Info, AlertTriangle, AlertCircle, CheckCircle, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LogoUploadSection } from '@/components/LogoUploadSection';
import { QuestionEditor } from '@/components/questionnaire/QuestionEditor';
import { getLogoUrl } from '@/utils/logoUtils';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import PaymentMethodEditor from '@/components/PaymentMethodEditor';
import { ENV_CONFIG } from '@/lib/env-config';
import { getCurrencySymbol as getCurrencySymbolUtil } from '@/utils/currencyFormatter';

// Import types from the new questionnaire module
import { QuestionItem, validateQuestionnaireStructure } from '@/types/questionnaire';

interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}

// Using environment variables for SMTP configuration only

interface AnnouncementBannerSettings {
  enabled: boolean;
  message: string;
  start_date: string;
  end_date: string;
  background_color: 'blue' | 'yellow' | 'red' | 'green';
  dismissible: boolean;
}

interface CompanySettingsData {
  id?: string;
  company_name: string;
  company_logo?: string;
  primary_phone: string;
  secondary_phone?: string;
  address: string;
  contact_email: string;
  currency: string;
  invoice_notes?: string;
  invoice_overdue_days: number;
  invoice_send_gap_days: number;
  payment_methods: PaymentMethod[];
  lms_url: string;
  // Student Sign-in & Questionnaire
  enable_student_signin: boolean;
  questionnaire: QuestionItem[];
  onboarding_video_url?: string;
  // Live Chat
  livechat_code?: string;
  // Multi-Course Feature
  multi_course_enabled: boolean;
  // Drip Content Feature
  drip_enabled_default: boolean;
  // Announcement Banner
  announcement_banner?: AnnouncementBannerSettings;
  // Branding
  branding?: {
    logo?: {
      original?: string;
      favicon?: string;
      header?: string;
    };
  };
  // Email CC Settings
  billing_email_cc?: string;
  notification_email_cc?: string;
  // Overdue Penalty & Suspension Notice
  overdue_penalty_type?: string;
  overdue_penalty_amount?: number;
  suspension_notice_note?: string;
}

export function CompanySettings() {
  const { toast } = useToast();

  const getCurrencySymbol = (currency: string): string => {
    return getCurrencySymbolUtil(currency);
  };
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettingsData>({
    company_name: ENV_CONFIG.DEFAULT_COMPANY_NAME,
    company_logo: '',
    primary_phone: '',
    secondary_phone: '',
    address: '',
    contact_email: '',
    currency: ENV_CONFIG.DEFAULT_CURRENCY,
    invoice_notes: '',
    invoice_overdue_days: ENV_CONFIG.DEFAULT_INVOICE_OVERDUE_DAYS,
    invoice_send_gap_days: ENV_CONFIG.DEFAULT_INVOICE_SEND_GAP_DAYS,
    payment_methods: [],
    lms_url: ENV_CONFIG.DEFAULT_LMS_URL,
    // Student Sign-in & Questionnaire
    enable_student_signin: false,
    questionnaire: [],
    onboarding_video_url: '',
    // Live Chat
    livechat_code: '',
    // Multi-Course Feature
    multi_course_enabled: false,
    // Drip Content Feature
    drip_enabled_default: false,
    // Announcement Banner
    announcement_banner: {
      enabled: false,
      message: '',
      start_date: '',
      end_date: '',
      background_color: 'blue',
      dismissible: true
    }
  });

  // State for editing questions
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  
  // State for invoice preview
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  
  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      // First try to fetch existing settings
      const { data, error } = await supabase
        .from('company_settings' as any)
        .select('*')
        .maybeSingle();

      if (error) {
        // If table doesn't exist, show error message and suggest contacting admin
        if (error.code === '42P01') {
          toast({
            title: 'Database Setup Required',
            description: 'Company settings table needs to be created. Please contact your system administrator.',
            variant: 'destructive'
          });
          return;
        }
        
        // If no records found, that's okay - we'll create one on save
        if (error.code !== 'PGRST116') {
          throw error;
        }
      }

      if (data) {
        const settingsData = data as unknown as CompanySettingsData;
        // Defensive null handling for optional fields
        setSettings(prev => ({
          ...prev,
          ...settingsData,
          drip_enabled_default: settingsData.drip_enabled_default ?? false,
          multi_course_enabled: settingsData.multi_course_enabled ?? false,
          enable_student_signin: settingsData.enable_student_signin ?? false,
          livechat_code: settingsData.livechat_code ?? '',
          questionnaire: settingsData.questionnaire ?? [],
          payment_methods: settingsData.payment_methods ?? [],
          announcement_banner: settingsData.announcement_banner ?? {
            enabled: false,
            message: '',
            start_date: '',
            end_date: '',
            background_color: 'blue',
            dismissible: true
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanySettingsData, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings' as any)
        .upsert({
          id: settings.id || 1, // Use existing ID or default to 1
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company settings saved successfully'
      });

      // Refresh to get the latest data
      fetchCompanySettings();
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save company settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Logo update handler
  const handleLogoUpdate = (branding: any) => {
    setSettings(prev => ({ ...prev, branding }));
  };

  // Questionnaire management functions
  const handleQuestionSave = (question: QuestionItem) => {
    const existingIndex = settings.questionnaire.findIndex(q => q.id === question.id);
    
    if (existingIndex >= 0) {
      // Update existing question
      const updatedQuestionnaire = [...settings.questionnaire];
      updatedQuestionnaire[existingIndex] = question;
      setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
      setEditingQuestion(null);
      
      toast({
        title: 'Question Updated',
        description: 'Question has been updated successfully.'
      });
    } else {
      // Add new question
      const updatedQuestionnaire = [...settings.questionnaire, question];
      setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
      setIsAddingQuestion(false);
      
      toast({
        title: 'Question Added',
        description: 'New question has been added to the questionnaire.'
      });
    }
  };

  const deleteQuestion = (questionId: string) => {
    const updatedQuestionnaire = settings.questionnaire
      .filter(q => q.id !== questionId)
      .map((q, index) => ({ ...q, order: index + 1 })); // Reorder after deletion
    
    setSettings(prev => ({ ...prev, questionnaire: updatedQuestionnaire }));
    setEditingQuestion(null);
    
    toast({
      title: 'Question Deleted',
      description: 'Question has been removed from the questionnaire.'
    });
  };

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = settings.questionnaire.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= settings.questionnaire.length) return;

    const updatedQuestionnaire = [...settings.questionnaire];
    const [movedItem] = updatedQuestionnaire.splice(currentIndex, 1);
    updatedQuestionnaire.splice(newIndex, 0, movedItem);

    // Update order numbers
    const reorderedQuestionnaire = updatedQuestionnaire.map((q, index) => ({ ...q, order: index + 1 }));
    
    setSettings(prev => ({ ...prev, questionnaire: reorderedQuestionnaire }));
  };

  // Generate sample invoice data for preview
  const generateSampleInvoiceData = () => {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + settings.invoice_overdue_days);

    return {
      invoice_number: `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: today.toLocaleDateString(),
      due_date: dueDate.toLocaleDateString(),
      student_name: 'John Doe',
      student_email: 'john.doe@example.com',
      items: [
        {
          description: 'Course Fee - Installment 1',
          installment_number: 1,
          price: 10000,
          total: 10000
        }
      ],
      subtotal: 10000,
      tax: 0,
      total: 10000,
      total_program_cost: 30000,
      total_installments: 3,
      currency: settings.currency || 'USD',
      payment_methods: settings.payment_methods || [],
      terms: settings.invoice_notes || 'Please send payment within 30 days of receiving this invoice.'
    };
  };

  const generateSampleCompanyDetails = () => {
    return {
      company_name: settings.company_name || 'Your Company',
      address: settings.address || 'Company Address',
      contact_email: settings.contact_email || ENV_CONFIG.SUPPORT_EMAIL,
      primary_phone: settings.primary_phone || ENV_CONFIG.SUPPORT_PHONE,
      company_logo: getLogoUrl(settings.branding, 'header')
    };
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading company settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Company Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your organization details and billing parameters
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Upload Section */}
        <div className="lg:col-span-2">
          <LogoUploadSection 
            currentLogo={getLogoUrl(settings.branding, 'header')}
            onLogoUpdate={handleLogoUpdate}
          />
        </div>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Company Address</Label>
              <Textarea
                id="address"
                value={settings.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter full company address"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary_phone">Primary Phone</Label>
              <Input
                id="primary_phone"
                value={settings.primary_phone}
                onChange={(e) => handleInputChange('primary_phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone">Secondary Phone (Optional)</Label>
              <Input
                id="secondary_phone"
                value={settings.secondary_phone || ''}
                onChange={(e) => handleInputChange('secondary_phone', e.target.value)}
                placeholder="+1 (555) 987-6543"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                placeholder={ENV_CONFIG.SUPPORT_EMAIL}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lms_url">LMS URL</Label>
              <Input
                id="lms_url"
                type="url"
                value={settings.lms_url}
                onChange={(e) => handleInputChange('lms_url', e.target.value)}
                placeholder={ENV_CONFIG.DEFAULT_LMS_URL}
              />
            </div>
          </CardContent>
        </Card>

        {/* Multi-Course Feature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Multi-Course Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="multi_course_enabled"
                checked={settings.multi_course_enabled}
                onCheckedChange={(checked) => handleInputChange('multi_course_enabled', checked)}
              />
              <Label htmlFor="multi_course_enabled" className="font-medium">
                Enable Multi-Course Support
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              When enabled, students can enroll in multiple courses and the platform will support course-specific content, 
              progress tracking, and learning pathways.
            </p>
          </CardContent>
        </Card>

        {/* Content Drip Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Content Drip Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="drip_enabled_default"
                checked={settings.drip_enabled_default}
                onCheckedChange={(checked) => handleInputChange('drip_enabled_default', checked)}
              />
              <Label htmlFor="drip_enabled_default" className="font-medium">
                Enable Content Drip by Default
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              When enabled, recordings will unlock based on days since enrollment. Each recording can have a "drip days" 
              value that determines when it becomes available. Courses and pathways can override this setting individually.
            </p>
          </CardContent>
        </Card>

        {/* Announcement Banner */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Announcement Banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="announcement_banner_enabled"
                checked={settings.announcement_banner?.enabled || false}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  announcement_banner: {
                    ...prev.announcement_banner!,
                    enabled: checked
                  }
                }))}
              />
              <Label htmlFor="announcement_banner_enabled" className="font-medium">
                Enable Announcement Banner
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Display an announcement banner at the top of the LMS for all users during the specified date range.
            </p>

            {settings.announcement_banner?.enabled && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  {/* Message */}
                  <div className="space-y-2">
                    <Label htmlFor="announcement_message">Banner Message</Label>
                    <Textarea
                      id="announcement_message"
                      value={settings.announcement_banner?.message || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        announcement_banner: {
                          ...prev.announcement_banner!,
                          message: e.target.value
                        }
                      }))}
                      placeholder="Enter your announcement message..."
                      rows={2}
                    />
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="announcement_start_date">Start Date</Label>
                      <Input
                        id="announcement_start_date"
                        type="datetime-local"
                        value={settings.announcement_banner?.start_date || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          announcement_banner: {
                            ...prev.announcement_banner!,
                            start_date: e.target.value
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="announcement_end_date">End Date</Label>
                      <Input
                        id="announcement_end_date"
                        type="datetime-local"
                        value={settings.announcement_banner?.end_date || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          announcement_banner: {
                            ...prev.announcement_banner!,
                            end_date: e.target.value
                          }
                        }))}
                      />
                    </div>
                  </div>

                  {/* Color and Dismissible */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="announcement_color">Banner Color</Label>
                      <Select
                        value={settings.announcement_banner?.background_color || 'blue'}
                        onValueChange={(value) => setSettings(prev => ({
                          ...prev,
                          announcement_banner: {
                            ...prev.announcement_banner!,
                            background_color: value as 'blue' | 'yellow' | 'red' | 'green'
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blue">
                            <div className="flex items-center gap-2">
                              <Info className="h-4 w-4 text-blue-600" />
                              Blue (Info)
                            </div>
                          </SelectItem>
                          <SelectItem value="yellow">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              Yellow (Warning)
                            </div>
                          </SelectItem>
                          <SelectItem value="red">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              Red (Critical)
                            </div>
                          </SelectItem>
                          <SelectItem value="green">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              Green (Success)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>User Dismissible</Label>
                      <div className="flex items-center space-x-2 pt-2">
                        <Switch
                          id="announcement_dismissible"
                          checked={settings.announcement_banner?.dismissible ?? true}
                          onCheckedChange={(checked) => setSettings(prev => ({
                            ...prev,
                            announcement_banner: {
                              ...prev.announcement_banner!,
                              dismissible: checked
                            }
                          }))}
                        />
                        <Label htmlFor="announcement_dismissible" className="font-normal text-sm text-muted-foreground">
                          Allow users to dismiss the banner
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {settings.announcement_banner?.message && (
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <div className={`py-3 px-4 rounded-lg flex items-center justify-center gap-3 ${
                        settings.announcement_banner?.background_color === 'blue' ? 'bg-blue-600 text-white' :
                        settings.announcement_banner?.background_color === 'yellow' ? 'bg-yellow-500 text-yellow-900' :
                        settings.announcement_banner?.background_color === 'red' ? 'bg-red-600 text-white' :
                        settings.announcement_banner?.background_color === 'green' ? 'bg-green-600 text-white' :
                        'bg-blue-600 text-white'
                      }`}>
                        {settings.announcement_banner?.background_color === 'blue' && <Info className="h-5 w-5" />}
                        {settings.announcement_banner?.background_color === 'yellow' && <AlertTriangle className="h-5 w-5" />}
                        {settings.announcement_banner?.background_color === 'red' && <AlertCircle className="h-5 w-5" />}
                        {settings.announcement_banner?.background_color === 'green' && <CheckCircle className="h-5 w-5" />}
                        <p className="text-sm font-medium">{settings.announcement_banner?.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Student Sign-in & Questionnaire */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Student Sign-in Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable Student Sign-in Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="enable_student_signin"
                checked={settings.enable_student_signin}
                onCheckedChange={(checked) => handleInputChange('enable_student_signin', checked)}
              />
              <Label htmlFor="enable_student_signin" className="font-medium">
                Enable Student First Sign-In Questionnaire
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Show a questionnaire to students during their first sign-in to collect additional information
            </p>

            {/* Questionnaire Management - only show when enabled */}
            {settings.enable_student_signin && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    First Sign-In Questions
                  </h4>

                  {/* Question List */}
                  <div className="space-y-3">
                    {settings.questionnaire.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No questions added yet. Click "Add Question" to get started.
                      </p>
                    ) : (
                      settings.questionnaire
                        .sort((a, b) => a.order - b.order)
                        .map((question, index) => (
                          <div key={question.id} className="space-y-2">
                            {editingQuestion === question.id ? (
                              <QuestionEditor
                                question={question}
                                onSave={handleQuestionSave}
                                onCancel={() => setEditingQuestion(null)}
                                nextOrder={settings.questionnaire.length + 1}
                              />
                            ) : (
                              <div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-card">
                                {/* Reorder buttons */}
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={index === 0}
                                    onClick={() => moveQuestion(question.id, 'up')}
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={index === settings.questionnaire.length - 1}
                                    onClick={() => moveQuestion(question.id, 'down')}
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Question content */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="text-sm font-medium">
                                    {index + 1}. {question.text}
                                    {question.required && <span className="text-destructive ml-1">*</span>}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Type: {question.answerType}
                                    {question.options && question.options.length > 0 && 
                                      ` • ${question.options.length} option${question.options.length !== 1 ? 's' : ''}`
                                    }
                                  </p>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingQuestion(question.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteQuestion(question.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                    )}

                    {/* Add New Question */}
                    {isAddingQuestion && (
                      <QuestionEditor
                        onSave={handleQuestionSave}
                        onCancel={() => setIsAddingQuestion(false)}
                        nextOrder={settings.questionnaire.length + 1}
                      />
                    )}

                    {/* Add Question Button */}
                    {!isAddingQuestion && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingQuestion(true)}
                        className="w-full border-dashed"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Student Onboarding Video */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Student Onboarding Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboarding_video_url">Onboarding Video URL</Label>
                <Input
                  id="onboarding_video_url"
                  type="url"
                  value={settings.onboarding_video_url || ''}
                  onChange={(e) => handleInputChange('onboarding_video_url', e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                />
                <p className="text-xs text-muted-foreground">
                  Enter the URL of a video (YouTube, Vimeo, Bunny Stream, or direct video link) that students must watch after completing the onboarding questionnaire. 
                  The video will be non-skippable and students must watch it completely before accessing their dashboard.
                  <br /><br />
                  <strong>Supported formats:</strong>
                  <br />• YouTube: https://www.youtube.com/watch?v=...
                  <br />• Vimeo: https://vimeo.com/...
                  <br />• Bunny Stream: https://iframe.mediadelivery.net/embed/... or https://video.bunnycdn.com/play/...
                  <br />• Direct: Any .mp4, .webm, or .ogg video URL
                </p>
                {settings.onboarding_video_url && (
                  <div className="mt-2 p-2 bg-muted rounded-md text-xs">
                    <strong>Preview:</strong> {settings.onboarding_video_url}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Chat Widget */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Live Chat Widget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="livechat_code">Live Chat Embed Code</Label>
              <Textarea
                id="livechat_code"
                value={settings.livechat_code || ''}
                onChange={(e) => handleInputChange('livechat_code', e.target.value)}
                placeholder="Paste your live chat embed code here (e.g., Tawk.to, Crisp, Intercom, Tidio script tag)..."
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Paste the JavaScript embed code from your live chat provider. This widget will be displayed across the entire LMS for students only.
                Supported providers include Tawk.to, Crisp, Intercom, Tidio, LiveChat, and any provider that uses a script tag embed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure CC email addresses for billing and notification emails. Multiple addresses can be separated by commas. 
              If left empty, the system will fall back to server-configured defaults.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="billing_email_cc">Billing Email CC</Label>
                <Input
                  id="billing_email_cc"
                  type="text"
                  value={settings.billing_email_cc || ''}
                  onChange={(e) => handleInputChange('billing_email_cc', e.target.value)}
                  placeholder="finance@company.com, billing@company.com"
                />
                <p className="text-xs text-muted-foreground">
                  CC recipients for invoices, payment reminders, and overdue notices
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification_email_cc">Notification Email CC</Label>
                <Input
                  id="notification_email_cc"
                  type="text"
                  value={settings.notification_email_cc || ''}
                  onChange={(e) => handleInputChange('notification_email_cc', e.target.value)}
                  placeholder="admin@company.com, manager@company.com"
                />
                <p className="text-xs text-muted-foreground">
                  CC recipients for account creation, credential updates, and general notifications
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={settings.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                    <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                    <SelectItem value="PKR">PKR (₨) - Pakistani Rupee</SelectItem>
                    <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                    <SelectItem value="CAD">CAD (C$) - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD (A$) - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select your preferred currency
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Invoice Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Configuration
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="invoice_send_gap_days">Invoice Send Gap (Days)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invoice_send_gap_days"
                      type="number"
                      min="1"
                      max="90"
                      value={settings.invoice_send_gap_days}
                      onChange={(e) => handleInputChange('invoice_send_gap_days', parseInt(e.target.value))}
                      placeholder="7"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days to wait before sending invoice
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_overdue_days">Invoice Overdue (Days)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invoice_overdue_days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.invoice_overdue_days}
                      onChange={(e) => handleInputChange('invoice_overdue_days', parseInt(e.target.value))}
                      placeholder="30"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Days after creation to mark overdue
                  </p>
                </div>
              </div>

              {/* Multiple Payment Methods Configuration */}
              <div className="space-y-4">
                <h5 className="font-medium text-base">Payment Methods</h5>
                <p className="text-sm text-muted-foreground">
                  Configure multiple payment methods that will be displayed on invoices
                </p>
                
                {/* Existing Payment Methods */}
                <div className="space-y-3">
                  {settings.payment_methods.map((method, index) => (
                    <PaymentMethodEditor
                      key={index}
                      method={method}
                      onUpdate={(updatedMethod) => {
                        const updatedMethods = [...settings.payment_methods];
                        updatedMethods[index] = updatedMethod;
                        setSettings(prev => ({ ...prev, payment_methods: updatedMethods }));
                      }}
                      onDelete={() => {
                        const updatedMethods = settings.payment_methods.filter((_, i) => i !== index);
                        setSettings(prev => ({ ...prev, payment_methods: updatedMethods }));
                      }}
                    />
                  ))}
                  
                  {/* Add New Payment Method Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const newMethod: PaymentMethod = {
                        type: 'bank_transfer',
                        name: 'Bank Transfer',
                        enabled: true,
                        details: {}
                      };
                      setSettings(prev => ({ 
                        ...prev, 
                        payment_methods: [...prev.payment_methods, newMethod] 
                      }));
                    }}
                    className="w-full border-dashed"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Payment Method
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_notes">Notes For Invoice</Label>
                <Textarea
                  id="invoice_notes"
                  value={settings.invoice_notes || ''}
                  onChange={(e) => handleInputChange('invoice_notes', e.target.value)}
                  placeholder="Additional notes to include in invoices..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Default notes to include in all invoices
                </p>
              </div>

              <Separator className="my-6" />

              {/* Overdue Penalty Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue Penalty Settings
                </h4>
                <p className="text-sm text-muted-foreground">
                  Configure a penalty that is applied per overdue installment. The penalty amount will be shown in the suspension notice email sent to students.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="overdue_penalty_type">Penalty Type</Label>
                    <Select 
                      value={settings.overdue_penalty_type || 'none'} 
                      onValueChange={(value) => handleInputChange('overdue_penalty_type', value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select penalty type" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="none">No Penalty</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="percentage">Percentage of Installment</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose whether the penalty is a fixed amount or percentage of the overdue installment
                    </p>
                  </div>
                  {settings.overdue_penalty_type && settings.overdue_penalty_type !== '' && (
                    <div className="space-y-2">
                      <Label htmlFor="overdue_penalty_amount">
                        {settings.overdue_penalty_type === 'fixed' 
                          ? `Penalty Amount (${getCurrencySymbol(settings.currency)})` 
                          : 'Penalty Percentage (%)'}
                      </Label>
                      <Input
                        id="overdue_penalty_amount"
                        type="number"
                        min="0"
                        step={settings.overdue_penalty_type === 'percentage' ? '0.1' : '1'}
                        value={settings.overdue_penalty_amount || ''}
                        onChange={(e) => handleInputChange('overdue_penalty_amount', parseFloat(e.target.value) || 0)}
                        placeholder={settings.overdue_penalty_type === 'fixed' ? 'e.g. 500' : 'e.g. 5'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {settings.overdue_penalty_type === 'fixed'
                          ? 'Fixed penalty amount added to each overdue installment'
                          : 'Percentage of the overdue installment amount added as penalty'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suspension_notice_note">Extra Note for Suspension Notice</Label>
                  <Textarea
                    id="suspension_notice_note"
                    value={settings.suspension_notice_note || ''}
                    onChange={(e) => handleInputChange('suspension_notice_note', e.target.value)}
                    placeholder="e.g. A penalty has been applied due to late payment. Contact finance@company.com for payment plans."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This note will be displayed in the suspension/overdue email sent to students, below the payment details
                  </p>
                </div>
              </div>

              {/* Invoice Preview Button */}
              <div className="flex justify-start mt-4">
                <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Invoice Preview</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <InvoiceTemplate
                        invoiceData={generateSampleInvoiceData()}
                        companyDetails={generateSampleCompanyDetails()}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Note: Fee amounts and installment counts are now configured per course/pathway in the Courses and Pathways sections.
            </p>
          </CardContent>
        </Card>


        {/* Save Button */}
        <div className="lg:col-span-2 flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            size="lg"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

    </div>
  );
}