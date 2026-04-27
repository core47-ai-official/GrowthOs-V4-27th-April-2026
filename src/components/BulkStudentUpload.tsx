import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, Upload, Download, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useEnhancedStudentCreation, EnhancedStudentData } from '@/hooks/useEnhancedStudentCreation'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BulkStudent {
  full_name: string
  email: string
  phone: string
  status: 'pending' | 'processing' | 'success' | 'error'
  error?: string
}

interface BulkStudentUploadProps {
  sharedSettings: {
    installment_count: number
    enrollment_type: 'course' | 'pathway'
    course_id: string
    pathway_id: string
    batch_id: string
    total_fee_amount: number
    discount_type: 'none' | 'fixed' | 'percentage'
    discount_amount: number
    discount_percentage: number
    drip_override: boolean
    drip_enabled: boolean
    sequential_override: boolean
    sequential_enabled: boolean
  }
  onComplete: () => void
  onClose: () => void
}

export const BulkStudentUpload: React.FC<BulkStudentUploadProps> = ({
  sharedSettings,
  onComplete,
  onClose
}) => {
  const [csvData, setCsvData] = useState('')
  const [students, setStudents] = useState<BulkStudent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  
  const { createStudent } = useEnhancedStudentCreation()

  // Parse CSV data
  const parseCSV = (data: string): BulkStudent[] => {
    const lines = data.trim().split('\n')
    const parsed: BulkStudent[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Skip header row if detected
      const lowerLine = line.toLowerCase()
      if (lowerLine.includes('name') && (lowerLine.includes('email') || lowerLine.includes('phone'))) {
        continue
      }
      
      // Try different delimiters: comma, tab, pipe
      let parts: string[] = []
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else if (line.includes('|')) {
        parts = line.split('|').map(p => p.trim())
      } else {
        // Handle CSV with potential quoted values
        parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
      }
      
      if (parts.length >= 3) {
        const [full_name, email, phone] = parts
        
        // Basic validation
        if (full_name && email && phone) {
          // Format phone number
          let formattedPhone = phone.replace(/[^\d+]/g, '')
          if (formattedPhone.startsWith('92') && !formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone
          }
          if (!formattedPhone.startsWith('+') && formattedPhone.length >= 10) {
            formattedPhone = '+' + formattedPhone
          }
          
          parsed.push({
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            phone: formattedPhone,
            status: 'pending'
          })
        }
      }
    }
    
    return parsed
  }

  const handleParse = () => {
    const parsed = parseCSV(csvData)
    setStudents(parsed)
  }

  const handleClear = () => {
    setCsvData('')
    setStudents([])
    setProcessedCount(0)
    setCurrentIndex(0)
  }

  const downloadTemplate = () => {
    const csv = 'Name,Email,Phone\nJohn Doe,john@example.com,+923001234567\nJane Smith,jane@example.com,+923009876543'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_upload_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processStudents = async () => {
    if (students.length === 0) return
    
    setIsProcessing(true)
    setProcessedCount(0)
    
    for (let i = 0; i < students.length; i++) {
      setCurrentIndex(i)
      const student = students[i]
      
      // Update status to processing
      setStudents(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'processing' } : s
      ))
      
      try {
        const studentData: EnhancedStudentData = {
          full_name: student.full_name,
          email: student.email,
          phone: student.phone,
          installment_count: sharedSettings.installment_count,
          course_id: sharedSettings.enrollment_type === 'course' ? sharedSettings.course_id : undefined,
          pathway_id: sharedSettings.enrollment_type === 'pathway' ? sharedSettings.pathway_id : undefined,
          batch_id: sharedSettings.batch_id || undefined,
          total_fee_amount: sharedSettings.total_fee_amount,
          discount_amount: sharedSettings.discount_type === 'fixed' ? sharedSettings.discount_amount : 0,
          discount_percentage: sharedSettings.discount_type === 'percentage' ? sharedSettings.discount_percentage : 0,
          drip_override: sharedSettings.drip_override,
          drip_enabled: sharedSettings.drip_override ? sharedSettings.drip_enabled : undefined,
          sequential_override: sharedSettings.sequential_override,
          sequential_enabled: sharedSettings.sequential_override ? sharedSettings.sequential_enabled : undefined
        }
        
        const result = await createStudent(studentData)
        
        if (result.success) {
          setStudents(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'success' } : s
          ))
        } else {
          setStudents(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'error', error: result.error || 'Unknown error' } : s
          ))
        }
      } catch (err) {
        setStudents(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' } : s
        ))
      }
      
      setProcessedCount(i + 1)
      
      // Small delay between requests to avoid rate limiting
      if (i < students.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    setIsProcessing(false)
    onComplete()
  }

  const successCount = students.filter(s => s.status === 'success').length
  const errorCount = students.filter(s => s.status === 'error').length
  const pendingCount = students.filter(s => s.status === 'pending').length

  const progress = students.length > 0 ? (processedCount / students.length) * 100 : 0

  const isSettingsValid = (sharedSettings.enrollment_type === 'course' && sharedSettings.course_id) ||
    (sharedSettings.enrollment_type === 'pathway' && sharedSettings.pathway_id)

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Upload Students
          </CardTitle>
          <CardDescription className="text-xs">
            Paste CSV data with columns: Name, Email, Phone (one student per line)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          
          <div className="space-y-2">
            <Label htmlFor="csv-data">Paste CSV Data</Label>
            <Textarea
              id="csv-data"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="Name,Email,Phone&#10;John Doe,john@example.com,+923001234567&#10;Jane Smith,jane@example.com,+923009876543"
              className="min-h-[120px] font-mono text-sm"
              disabled={isProcessing}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleParse}
              disabled={!csvData.trim() || isProcessing}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Parse Data
            </Button>
            {students.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClear}
                disabled={isProcessing}
                className="gap-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {students.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Preview ({students.length} students)
              </CardTitle>
              <div className="flex gap-2">
                {successCount > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {successCount} Success
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} Failed
                  </Badge>
                )}
                {pendingCount > 0 && !isProcessing && (
                  <Badge variant="secondary">
                    {pendingCount} Pending
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-sm">{student.email}</TableCell>
                      <TableCell className="text-sm font-mono">{student.phone}</TableCell>
                      <TableCell>
                        {student.status === 'pending' && (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                        {student.status === 'processing' && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {student.status === 'success' && (
                          <Badge className="bg-green-500 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Created
                          </Badge>
                        )}
                        {student.status === 'error' && (
                          <Badge variant="destructive" className="text-xs gap-1" title={student.error}>
                            <XCircle className="h-3 w-3" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processing students...</span>
              <span className="font-medium">{processedCount} / {students.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Validation Warning */}
      {!isSettingsValid && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Please select a course or pathway in the settings above before processing.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          onClick={processStudents}
          disabled={students.length === 0 || isProcessing || pendingCount === 0 || !isSettingsValid}
          className="gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Create {pendingCount} Students
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
