import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Mentor {
  id: string;
  email: string;
  role: string;
  assigned_students?: number;
}

interface Student {
  id: string;
  email: string;
}

export const MentorManagement = () => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMentors();
    fetchStudents();
  }, []);

  const fetchMentors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'mentor')
        .order('email');

      if (error) throw error;
      setMentors(data || []);
    } catch (error) {
      console.error('Error fetching mentors:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch mentors',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('role', 'student')
        .order('email');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const createMentor = async (email: string, password: string) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw authError;

      // Update user role
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'mentor' })
        .eq('id', authData.user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Mentor created successfully'
      });

      fetchMentors();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating mentor:', error);
      toast({
        title: 'Error',
        description: 'Failed to create mentor',
        variant: 'destructive'
      });
    }
  };

  const assignStudent = async (mentorId: string, studentId: string) => {
    try {
      // Mock assignment until types are regenerated
      toast({
        title: 'Success',
        description: 'Student assigned successfully (demo mode)'
      });

      setIsAssignDialogOpen(false);
    } catch (error) {
      console.error('Error assigning student:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign student',
        variant: 'destructive'
      });
    }
  };

  const filteredMentors = mentors.filter(mentor =>
    mentor.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading mentors...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Mentor Management</CardTitle>
          <div className="flex space-x-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mentor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Mentor</DialogTitle>
                </DialogHeader>
                <CreateMentorForm onSubmit={createMentor} />
              </DialogContent>
            </Dialog>
            
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Assign Students
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Student to Mentor</DialogTitle>
                </DialogHeader>
                <AssignStudentForm
                  mentors={mentors}
                  students={students}
                  onSubmit={assignStudent}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search mentors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Students</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMentors.map((mentor) => (
              <TableRow key={mentor.id}>
                <TableCell>{mentor.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">Mentor</Badge>
                </TableCell>
                <TableCell>{mentor.assigned_students || 0}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMentor(mentor);
                      setIsAssignDialogOpen(true);
                    }}
                  >
                    Manage Students
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const CreateMentorForm = ({ onSubmit }: { onSubmit: (email: string, password: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
    setEmail('');
    setPassword('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full">Create Mentor</Button>
    </form>
  );
};

const AssignStudentForm = ({ 
  mentors, 
  students, 
  onSubmit 
}: { 
  mentors: Mentor[]; 
  students: Student[]; 
  onSubmit: (mentorId: string, studentId: string) => void;
}) => {
  const [selectedMentor, setSelectedMentor] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMentor && selectedStudent) {
      onSubmit(selectedMentor, selectedStudent);
      setSelectedMentor('');
      setSelectedStudent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Select Mentor</label>
        <Select value={selectedMentor} onValueChange={setSelectedMentor}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a mentor" />
          </SelectTrigger>
          <SelectContent>
            {mentors.map((mentor) => (
              <SelectItem key={mentor.id} value={mentor.id}>
                {mentor.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Select Student</label>
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={!selectedMentor || !selectedStudent}>
        Assign Student
      </Button>
    </form>
  );
};