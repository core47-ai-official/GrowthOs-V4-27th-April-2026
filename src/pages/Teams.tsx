import { useState, useEffect } from 'react';
import { safeLogger } from '@/lib/safe-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Plus, Activity, Eye, Edit, Trash2, Key } from 'lucide-react';
import { useAuth, User } from '@/hooks/useAuth';
import AdminTeams from '@/components/admin/AdminTeams';
import { ActivityLogsDialog } from '@/components/ActivityLogsDialog';
import { CredentialDisplay } from '@/components/ui/credential-display';
import { generateSecurePassword } from '@/utils/passwordGenerator';
interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  lms_user_id: string;
  created_at: string;
  last_active_at: string;
  status: string;
  password_display?: string;
}
const Teams = () => {
  const {
    user
  }: {
    user: User | null;
  } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [isEditPasswordDialogOpen, setIsEditPasswordDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editData, setEditData] = useState({
    email: '',
    password: ''
  });
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    role: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { deleteUser, loading: deleteLoading } = useUserManagement();
  const fetchTeamMembers = async () => {
    try {
      const {
        data,
        error
      } = await supabase
        .from('users')
        .select('*')
        .in('role', user?.role === 'superadmin' ? ['superadmin', 'admin', 'mentor', 'enrollment_manager', 'support_member'] : ['admin', 'mentor', 'enrollment_manager', 'support_member'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('Fetched team members - Count:', data?.length);
      console.log('Sample member data:', data?.[0]);
      console.log('Current user role:', user?.role);
      
      setTeamMembers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleAddMember = async () => {
    if (!newMember.full_name.trim() || !newMember.email.trim() || !newMember.role) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMember.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    // Begin add operation
    setIsAdding(true);

    // Check if email already exists in our database
    try {
      const {
        data: existingUser
      } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', newMember.email.toLowerCase())
        .maybeSingle();
      if (existingUser) {
        toast({
          title: "Email Already Exists",
          description: `A ${existingUser.role} with email ${existingUser.email} already exists. Please use a different email address.`,
          variant: "destructive"
        });
        setIsAdding(false);
        return;
      }
    } catch (error) {
      console.error('Error checking existing email:', error);
    }
    try {
      // Create user via enhanced edge function
      const response = await supabase.functions.invoke('create-enhanced-team-member', {
        body: {
          email: newMember.email.toLowerCase().trim(),
          full_name: newMember.full_name.trim(),
          role: newMember.role
        }
      });
      if (response.error) {
        console.error('Error creating team member:', response.error);

        // Handle different types of errors from the edge function
        let errorMessage = 'Failed to create team member';
        if (response.error.message) {
          try {
            // Try to parse as JSON first (for structured error responses)
            const errorData = JSON.parse(response.error.message);
            errorMessage = errorData.error || errorData.message || response.error.message;
          } catch {
            // If not JSON, use the message directly
            errorMessage = response.error.message;
          }
        }

        // Handle specific error cases with better messaging
        if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('email_exists')) {
          toast({
            title: "Email Already Registered",
            description: "This email is already registered in the system. Please use a different email address.",
            variant: "destructive"
          });
          return;
        }
        throw new Error(errorMessage);
      }
      if (!response.data?.success) {
        const errorMsg = response.data?.error || 'Failed to create team member';

        // Handle duplicate email from edge function response
        if (errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('email_exists')) {
          toast({
            title: "Email Already Registered",
            description: "This email is already registered in the system. Please use a different email address.",
            variant: "destructive"
          });
          return;
        }
        throw new Error(errorMsg);
      }

      // Trigger email processing instead of direct email sending
      try {
        safeLogger.info('Triggering email queue processing for new team member');
        const processResult = await supabase.functions.invoke('process-email-queue');
        safeLogger.info('Email processing result', { success: !processResult.error });
        const successMessage = `${newMember.role} account created and credential email sent to ${newMember.email}`;
        toast({
          title: "Success",
          description: successMessage
        });
      } catch (emailError) {
        // User was created but email failed  
        const failureMessage = `Account created but failed to send credential email. Password: ${response.data?.generated_password || 'Contact admin'}`;
        toast({
          title: "Warning",
          description: failureMessage,
          variant: "destructive"
        });
      }
      setNewMember({
        full_name: '',
        email: '',
        role: ''
      });
      setIsAddDialogOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add team member: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };
  const handleEditMember = async () => {
    if (!selectedMember || !editData.email && !editData.password) {
      toast({
        title: "Error",
        description: "Please fill in at least one field to update",
        variant: "destructive"
      });
      return;
    }
    try {
      const updateData: any = {};
      if (editData.email) updateData.email = editData.email;
      // Password updates removed for security

      const {
        error
      } = await supabase.from('users').update(updateData).eq('id', selectedMember.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Student details updated successfully"
      });
      setIsEditPasswordDialogOpen(false);
      setEditData({
        email: '',
        password: ''
      });
      setSelectedMember(null);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update student: " + error.message,
        variant: "destructive"
      });
    }
  };
  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const success = await deleteUser(memberId);
    if (success) {
      toast({
        title: "Success",
        description: `${memberName} has been deleted successfully`
      });
      fetchTeamMembers();
    }
  };
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  // Show restricted admin version for admin users
  if (user?.role === 'admin') {
    return <AdminTeams />;
  }
  const adminCount = teamMembers.filter(m => m.role === 'admin').length;
  const mentorCount = teamMembers.filter(m => m.role === 'mentor').length;
  const studentCount = teamMembers.filter(m => m.role === 'student').length;
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team members...</p>
        </div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={newMember.full_name} onChange={e => setNewMember({
                ...newMember,
                full_name: e.target.value
              })} placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={newMember.email} onChange={e => setNewMember({
                ...newMember,
                email: e.target.value
              })} placeholder="Enter email address" />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={newMember.role} onValueChange={value => setNewMember({
                ...newMember,
                role: value
              })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                 <SelectContent>
                     {user?.role === 'superadmin' && <>
                         <SelectItem value="admin">Admin</SelectItem>
                       </>}
                     <SelectItem value="mentor">Mentor</SelectItem>
                     <SelectItem value="enrollment_manager">Enrollment Manager</SelectItem>
                     <SelectItem value="support_member">Support Member</SelectItem>
                   </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddMember} disabled={isAdding} className="w-full">
                {isAdding ? 'Adding...' : 'Add Team Member'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{adminCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Mentors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{mentorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map(member => <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'Active' ? 'default' : 'destructive'} className="bg-lime-600">
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Dialog open={credentialDialogOpen && selectedMember?.id === member.id} onOpenChange={open => {
                    setCredentialDialogOpen(open);
                    if (!open) setSelectedMember(null);
                  }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={async () => {
                              setSelectedMember(member);
                              // Fetch password securely for superadmins
                              if (user?.role === 'superadmin') {
                                const { data, error } = await supabase.rpc('get_team_member_password', {
                                  member_id: member.id
                                });
                                if (!error && data) {
                                  setSelectedMember({ ...member, password_display: data });
                                }
                              }
                            }}
                          >
                            <Key className="w-4 h-4 mr-1" />
                            Credentials
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Login Credentials - {selectedMember?.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm font-medium">Email</Label>
                              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded">{selectedMember?.email}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">
                                {user?.role === 'superadmin' ? 'Password' : 'Access'}
                              </Label>
                              {user?.role === 'superadmin' ? <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded font-mono">
                                  {selectedMember?.password_display || 'Loading password...'}
                                </p> : <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                                  Credentials are securely managed through the system
                                </p>}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <ActivityLogsDialog userId={member.id} userName={member.full_name}>
                        <Button variant="outline" size="sm">
                          <Activity className="w-4 h-4 mr-1" />
                          Activity
                        </Button>
                      </ActivityLogsDialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {member.full_name} and remove all their data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMember(member.id, member.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={isEditPasswordDialogOpen} onOpenChange={setIsEditPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student Details - {selectedMember?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editData.email} onChange={e => setEditData({
              ...editData,
              email: e.target.value
            })} placeholder={selectedMember?.email} />
            </div>
            <div>
              <Label htmlFor="edit-password">Password</Label>
              <Input id="edit-password" type="text" value={editData.password} onChange={e => setEditData({
              ...editData,
              password: e.target.value
            })} placeholder="Enter new password" />
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleEditMember} className="flex-1">
                Update Details
              </Button>
              <Button variant="outline" onClick={() => {
              setIsEditPasswordDialogOpen(false);
              setEditData({
                email: '',
                password: ''
              });
              setSelectedMember(null);
            }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>;
};
export default Teams;