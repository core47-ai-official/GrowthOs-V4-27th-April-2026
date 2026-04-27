import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, UserPlus, Users, Eye, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserManagement } from "@/hooks/useUserManagement";
import { EnhancedStudentCreationDialog } from "@/components/EnhancedStudentCreationDialog";
import { CredentialDisplayDialog } from "@/components/CredentialDisplayDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  created_at: string;
  student_id?: string;
  metadata?: any;
}

// QuickTestEmailSender removed - using Supabase built-in email

const StudentsManagement = () => {
  const { user, hasRole } = useAuth();
  const { deleteUser, loading } = useUserManagement();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const { toast } = useToast();

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch students:', error);
        return;
      }

      setStudents((data || []).filter(user => user.role === 'student'));
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDeleteStudent = async (studentId: string) => {
    const success = await deleteUser(studentId);
    if (success) {
      fetchStudents();
    }
  };

  const handleStudentCreated = () => {
    fetchStudents();
  };

  const handleAddStudentClick = () => {
    // Check permissions before opening dialog
    if (!hasRole(['superadmin', 'admin', 'enrollment_manager'])) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create students.",
        variant: "destructive",
      });
      return;
    }
    setIsDialogOpen(true);
  };

  const handleViewCredentials = (student: Student) => {
    setSelectedStudent(student);
    setCredentialDialogOpen(true);
  };

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setEditDialogOpen(true);
  };

  // Check permissions for page access
  if (!user || !hasRole(['superadmin', 'admin', 'enrollment_manager'])) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to manage students.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Email Sender removed - using Supabase built-in email */}
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
          <p className="text-gray-600">Manage student accounts and enrollment</p>
        </div>
        <Button onClick={handleAddStudentClick}>
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

        <EnhancedStudentCreationDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onStudentCreated={handleStudentCreated}
        />

        <EditStudentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          student={selectedStudent}
          onStudentUpdated={handleStudentCreated}
        />

        <CredentialDisplayDialog
          open={credentialDialogOpen}
          onOpenChange={setCredentialDialogOpen}
          student={selectedStudent}
        />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return new Date(s.created_at) > oneMonthAgo;
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Week</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return new Date(s.created_at) > oneWeekAgo;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Students</CardTitle>
          <CardDescription>
            Manage student accounts and their access to the learning platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.student_id || 'N/A'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {student.full_name || student.email}
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>
                    {new Date(student.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {hasRole(['superadmin', 'admin']) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditStudent(student)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewCredentials(student)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Credentials
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteStudent(student.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No students found. Create your first student account above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentsManagement;