import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, BadgePercent, BookOpen, Route, Settings2, ChevronDown, ChevronUp, Users, UserPlus, Upload } from 'lucide-react'
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions'
import { useEnhancedStudentCreation } from '@/hooks/useEnhancedStudentCreation'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BulkStudentUpload } from './BulkStudentUpload'

interface EnhancedStudentCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentCreated: () => void
}

type EnrollmentType = 'course' | 'pathway'

interface Course {
  id: string
  title: string
  price: number | null
  currency: string | null
}

interface Pathway {
  id: string
  name: string
  price: number | null
  currency: string | null
}

interface Batch {
  id: string
  name: string
  start_date: string
  course_id: string | null
  pathway_id: string | null
}

export const EnhancedStudentCreationDialog: React.FC<EnhancedStudentCreationDialogProps> = ({
  open,
  onOpenChange,
  onStudentCreated
}) => {
  const { createStudent, isLoading } = useEnhancedStudentCreation()
  const { options: installmentOptions, isLoading: installmentLoading } = useInstallmentOptions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdStudentInfo, setCreatedStudentInfo] = useState<any>(null)
  
  const { hasRole } = useAuth()
  const canApplyDiscount = hasRole(['admin', 'superadmin'])
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    installment_count: 1,
    enrollment_type: 'course' as EnrollmentType,
    course_id: '',
    pathway_id: '',
    batch_id: '',
    discount_type: 'none' as 'none' | 'fixed' | 'percentage',
    discount_amount: 0,
    discount_percentage: 0,
    // Access control overrides
    drip_override: false,
    drip_enabled: false,
    sequential_override: false,
    sequential_enabled: false
  })
  
  const [accessSettingsOpen, setAccessSettingsOpen] = useState(false)
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single')

  // Fetch company settings for currency
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('original_fee_amount, currency')
        .eq('id', 1)
        .single()
      if (error) throw error
      return data
    }
  })

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, price, currency')
        .eq('is_active', true)
        .order('sequence_order')
      if (error) throw error
      return data as Course[]
    }
  })

  // Fetch pathways
  const { data: pathways = [] } = useQuery({
    queryKey: ['pathways-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_pathways')
        .select('id, name, price, currency')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as Pathway[]
    }
  })

  // Fetch batches (most recent first)
  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, start_date, course_id, pathway_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Batch[]
    }
  })

  // Track if user has explicitly set batch preference
  const [batchUserSelected, setBatchUserSelected] = React.useState(false)
  
  // Set default batch to most recent when batches load (only if user hasn't selected yet)
  React.useEffect(() => {
    if (batches.length > 0 && !batchUserSelected && formData.batch_id === '') {
      setFormData(prev => ({ ...prev, batch_id: batches[0].id }))
    }
  }, [batches, batchUserSelected])

  const currency = companySettings?.currency || 'PKR'

  const formatBatchStartDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
  }

  // Get selected item's price
  const selectedPrice = useMemo(() => {
    if (formData.enrollment_type === 'course' && formData.course_id) {
      const course = courses.find(c => c.id === formData.course_id)
      return course?.price || 0
    } else if (formData.enrollment_type === 'pathway' && formData.pathway_id) {
      const pathway = pathways.find(p => p.id === formData.pathway_id)
      return pathway?.price || 0
    }
    return 0
  }, [formData.enrollment_type, formData.course_id, formData.pathway_id, courses, pathways])

  // Calculate final amount with discount
  const calculatedAmounts = useMemo(() => {
    let finalAmount = selectedPrice
    let discountApplied = 0

    if (formData.discount_type === 'percentage' && formData.discount_percentage > 0) {
      discountApplied = selectedPrice * (formData.discount_percentage / 100)
      finalAmount = selectedPrice - discountApplied
    } else if (formData.discount_type === 'fixed' && formData.discount_amount > 0) {
      discountApplied = formData.discount_amount
      finalAmount = selectedPrice - discountApplied
    }

    finalAmount = Math.max(0, finalAmount)
    const perInstallment = formData.installment_count > 0 ? finalAmount / formData.installment_count : 0

    return {
      originalFee: selectedPrice,
      discountApplied,
      finalAmount,
      perInstallment
    }
  }, [selectedPrice, formData.discount_type, formData.discount_amount, formData.discount_percentage, formData.installment_count])

  const handleEnrollmentTypeChange = (value: EnrollmentType) => {
    setFormData(prev => ({
      ...prev,
      enrollment_type: value,
      course_id: '',
      pathway_id: '',
      discount_amount: 0,
      discount_percentage: 0,
      discount_type: 'none'
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting || isLoading) return
    setIsSubmitting(true)
    setCurrentStep('Validating information...')
    
    try {
      if (!formData.email || !formData.full_name || !formData.phone || formData.installment_count < 1) {
        return
      }

      // Validate course/pathway selection
      if (formData.enrollment_type === 'course' && !formData.course_id) {
        return
      }
      if (formData.enrollment_type === 'pathway' && !formData.pathway_id) {
        return
      }

      setCurrentStep('Creating user account...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setCurrentStep('Setting up student profile...')
      const result = await createStudent({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        installment_count: formData.installment_count,
        course_id: formData.enrollment_type === 'course' ? formData.course_id : undefined,
        pathway_id: formData.enrollment_type === 'pathway' ? formData.pathway_id : undefined,
        batch_id: formData.batch_id || undefined,
        total_fee_amount: selectedPrice,
        discount_amount: formData.discount_type === 'fixed' ? formData.discount_amount : 0,
        discount_percentage: formData.discount_type === 'percentage' ? formData.discount_percentage : 0,
        // Access control overrides
        drip_override: formData.drip_override,
        drip_enabled: formData.drip_override ? formData.drip_enabled : undefined,
        sequential_override: formData.sequential_override,
        sequential_enabled: formData.sequential_override ? formData.sequential_enabled : undefined
      })

      if (result.success) {
        setCurrentStep('Sending credentials email...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setCreatedStudentInfo(result.data)
        setShowSuccess(true)
        setCurrentStep('')
        
        // Reset form and close after showing success
        setTimeout(() => {
          setFormData({
            full_name: '',
            email: '',
            phone: '',
            installment_count: 1,
            enrollment_type: 'course',
            course_id: '',
            pathway_id: '',
            batch_id: batches.length > 0 ? batches[0].id : '',
            discount_type: 'none',
            discount_amount: 0,
            discount_percentage: 0,
            drip_override: false,
            drip_enabled: false,
            sequential_override: false,
            sequential_enabled: false
          })
          setAccessSettingsOpen(false)
          setShowSuccess(false)
          setCreatedStudentInfo(null)
          onOpenChange(false)
          onStudentCreated()
        }, 3000)
      }
    } finally {
      if (!showSuccess) {
        setIsSubmitting(false)
        setCurrentStep('')
      }
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.email && formData.full_name && formData.phone && 
    ((formData.enrollment_type === 'course' && formData.course_id) || 
     (formData.enrollment_type === 'pathway' && formData.pathway_id))

  return (
    <Dialog open={open} onOpenChange={(open) => !isSubmitting && onOpenChange(open)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? '✅ Student Created Successfully!' : 'Add New Student'}
          </DialogTitle>
        </DialogHeader>
        
        {showSuccess ? (
          <div className="space-y-4 py-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>{createdStudentInfo?.full_name}</strong> has been added successfully.
              </p>
              <p className="text-xs text-muted-foreground">
                Student ID: <strong>{createdStudentInfo?.student_id}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Credentials have been sent to <strong>{createdStudentInfo?.email}</strong>
              </p>
            </div>
          </div>
        ) : (
          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'single' | 'bulk')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="single" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Single Student
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single">
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Two-column grid for main fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Student Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter student's full name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  let value = e.target.value.trim()
                  // Keep only digits and optional leading +
                  value = value.replace(/[^\d+]/g, '')
                  // Ensure only one + at the start
                  if (value.indexOf('+') > 0) {
                    value = value.replace(/\+/g, '')
                  }
                  // Convert 92xxxxxxxxxx to +92xxxxxxxxxx
                  if (value.startsWith('92') && !value.startsWith('+')) {
                    value = '+' + value
                  }
                  handleInputChange('phone', value)
                }}
                placeholder="+923001234567"
                pattern="^\+?[1-9]\d{1,14}$"
                title="Enter phone in E.164 format (e.g., +923001234567)"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="installments">Number of Installments *</Label>
              <Select 
                value={formData.installment_count.toString()} 
                onValueChange={(value) => handleInputChange('installment_count', parseInt(value))}
                disabled={installmentLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select installment plan" />
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map((option) => {
                    const count = parseInt(option.value.split('_')[0])
                    return (
                      <SelectItem key={option.value} value={count.toString()}>
                        {option.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Course/Pathway Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Enrollment *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Enrollment Type</Label>
                <RadioGroup
                  value={formData.enrollment_type}
                  onValueChange={(value) => handleEnrollmentTypeChange(value as EnrollmentType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="course" id="enroll-course" />
                    <Label htmlFor="enroll-course" className="flex items-center gap-1.5 cursor-pointer">
                      <BookOpen className="w-4 h-4" />
                      Course
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pathway" id="enroll-pathway" />
                    <Label htmlFor="enroll-pathway" className="flex items-center gap-1.5 cursor-pointer">
                      <Route className="w-4 h-4" />
                      Pathway
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.enrollment_type === 'course' ? (
                <div className="space-y-2">
                  <Label>Select Course *</Label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        course_id: value,
                        discount_amount: 0,
                        discount_percentage: 0,
                        discount_type: 'none'
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title} - {currency} {(course.price || 0).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select Pathway *</Label>
                  <Select
                    value={formData.pathway_id}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        pathway_id: value,
                        discount_amount: 0,
                        discount_percentage: 0,
                        discount_type: 'none'
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pathway" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {pathways.map((pathway) => (
                        <SelectItem key={pathway.id} value={pathway.id}>
                          {pathway.name} - {currency} {(pathway.price || 0).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show price info */}
              {selectedPrice > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Fee:</span>
                    <span className="font-semibold">{currency} {selectedPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batch Selection (Optional) */}
          {batches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Batch Assignment (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Select Batch</Label>
                <Select
                  value={formData.batch_id || "none"}
                  onValueChange={(value) => {
                    setBatchUserSelected(true)
                    setFormData(prev => ({ ...prev, batch_id: value === "none" ? "" : value }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a batch" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="none">No Batch (Use LMS Access Date)</SelectItem>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name} (Start: {formatBatchStartDate(batch.start_date)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If assigned to a batch, content drip will be calculated from the batch start date instead of LMS access date.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Access Settings Section (Drip/Sequential Override) */}
          {canApplyDiscount && (formData.course_id || formData.pathway_id) && (
            <Collapsible open={accessSettingsOpen} onOpenChange={setAccessSettingsOpen}>
              <Card className="border-blue-200 bg-blue-50/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-blue-100/50 transition-colors">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Access Settings (Admin Only)
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
                        <Label htmlFor="drip-override" className="flex flex-col">
                          <span>Override Content Dripping</span>
                          <span className="font-normal text-xs text-muted-foreground">
                            Control when recordings become available
                          </span>
                        </Label>
                        <Switch
                          id="drip-override"
                          checked={formData.drip_override}
                          onCheckedChange={(checked) => handleInputChange('drip_override', checked ? 1 : 0)}
                        />
                      </div>
                      
                      {formData.drip_override && (
                        <RadioGroup
                          value={formData.drip_enabled ? 'enabled' : 'disabled'}
                          onValueChange={(value) => handleInputChange('drip_enabled', value === 'enabled' ? 1 : 0)}
                          className="pl-4 space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="disabled" id="drip-disabled" />
                            <Label htmlFor="drip-disabled" className="font-normal cursor-pointer">
                              Disable dripping (all content available immediately)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="enabled" id="drip-enabled" />
                            <Label htmlFor="drip-enabled" className="font-normal cursor-pointer">
                              Enable dripping (content unlocks over time)
                            </Label>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                    
                    {/* Sequential Unlock Override */}
                    <div className="space-y-3 p-3 rounded-lg border border-blue-200 bg-white/50">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sequential-override" className="flex flex-col">
                          <span>Override Sequential Unlock</span>
                          <span className="font-normal text-xs text-muted-foreground">
                            Control whether recordings must be watched in order
                          </span>
                        </Label>
                        <Switch
                          id="sequential-override"
                          checked={formData.sequential_override}
                          onCheckedChange={(checked) => handleInputChange('sequential_override', checked ? 1 : 0)}
                        />
                      </div>
                      
                      {formData.sequential_override && (
                        <RadioGroup
                          value={formData.sequential_enabled ? 'enabled' : 'disabled'}
                          onValueChange={(value) => handleInputChange('sequential_enabled', value === 'enabled' ? 1 : 0)}
                          className="pl-4 space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="disabled" id="sequential-disabled" />
                            <Label htmlFor="sequential-disabled" className="font-normal cursor-pointer">
                              Disable sequential unlock (watch any recording)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="enabled" id="sequential-enabled" />
                            <Label htmlFor="sequential-enabled" className="font-normal cursor-pointer">
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

          {/* Admin-Only Discount Section - Full Width */}
          {canApplyDiscount && selectedPrice > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BadgePercent className="h-4 w-4" />
                  Discount (Admin Only)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(value: 'none' | 'fixed' | 'percentage') => {
                        setFormData(prev => ({ 
                          ...prev, 
                          discount_type: value,
                          discount_amount: 0,
                          discount_percentage: 0
                        }))
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

                {formData.discount_type === 'fixed' && (
                  <div className="space-y-2">
                    <Label>Discount Amount ({currency})</Label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedPrice}
                      step="0.01"
                      value={formData.discount_amount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_amount', Math.min(selectedPrice, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                    />
                  </div>
                )}

                {formData.discount_type === 'percentage' && (
                  <div className="space-y-2">
                    <Label>Discount Percentage (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        handleInputChange('discount_percentage', Math.min(100, Math.max(0, value)))
                      }}
                      placeholder="0.00"
                    />
                  </div>
                )}
                </div>

                {formData.discount_type !== 'none' && (
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
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Per Installment:</span>
                      <span>{currency} {calculatedAmounts.perInstallment.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || !isFormValid || installmentLoading}
              >
                {(isLoading || isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Student
              </Button>
            </div>
            
            {(isLoading || isSubmitting) && currentStep && (
              <div className="pt-2 space-y-2">
                <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {currentStep}
                </p>
                <div className="text-xs text-muted-foreground text-center">
                  {currentStep.includes('account') && 'Step 1/3'}
                  {currentStep.includes('profile') && 'Step 2/3'}
                  {currentStep.includes('email') && 'Step 3/3 - Almost done!'}
                </div>
              </div>
            )}
          </form>
            </TabsContent>
            
            <TabsContent value="bulk">
              <BulkStudentUpload
                sharedSettings={{
                  installment_count: formData.installment_count,
                  enrollment_type: formData.enrollment_type,
                  course_id: formData.course_id,
                  pathway_id: formData.pathway_id,
                  batch_id: formData.batch_id,
                  total_fee_amount: selectedPrice,
                  discount_type: formData.discount_type,
                  discount_amount: formData.discount_amount,
                  discount_percentage: formData.discount_percentage,
                  drip_override: formData.drip_override,
                  drip_enabled: formData.drip_enabled,
                  sequential_override: formData.sequential_override,
                  sequential_enabled: formData.sequential_enabled
                }}
                onComplete={() => onStudentCreated()}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
