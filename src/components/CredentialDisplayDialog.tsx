import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'

interface Student {
  id: string
  email: string
  full_name: string
  student_id?: string
  password_display?: string
  lms_user_id?: string
  role: string
  created_at: string
}

interface CredentialDisplayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student | null
}

export const CredentialDisplayDialog: React.FC<CredentialDisplayDialogProps> = ({
  open,
  onOpenChange,
  student
}) => {
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)

  if (!student) return null

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Student Credentials - {student.full_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Student Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-3">Student Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-blue-700">Student ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">{student.student_id || 'Not assigned'}</code>
                  {student.student_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(student.student_id!, 'Student ID')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-blue-700">Email</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">{student.email}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(student.email, 'Email')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* LMS Credentials */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-3">LMS Access Credentials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-green-700">LMS User ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">{student.lms_user_id || student.email}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(student.lms_user_id || student.email, 'LMS User ID')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-green-700">LMS Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">
                    Contact system admin for LMS password
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Credentials */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-900 mb-3">Platform Login Credentials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-purple-700">Login Email</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">{student.email}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(student.email, 'Login Email')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-purple-700">Login Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-sm">
                    {showPassword ? (student.password_display || 'Not available') : '••••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  {showPassword && student.password_display && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(student.password_display!, 'Login Password')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Account Status</h3>
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <div className="mt-1">
                  <Badge variant="secondary">{student.role}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Created</Label>
                <div className="mt-1">
                  <span className="text-sm text-gray-600">
                    {new Date(student.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}