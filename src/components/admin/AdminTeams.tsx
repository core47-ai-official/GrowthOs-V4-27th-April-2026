
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Plus, Activity, Trash2 } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  lms_user_id: string;
  created_at: string;
  last_active_at: string;
  status: string;
}

const AdminTeams = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    role: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { deleteUser, loading: deleteLoading } = useUserManagement();

  const fetchTeamMembers = async () => {
    try {
      // Admins can see mentors and enrollment managers
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['mentor', 'enrollment_manager', 'support_member'])
        .order('created_at', { ascending: false });

      if (error) throw error;
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

  const fetchActivityLogs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .eq('performed_by', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs((data || []).map(log => ({
        ...log,
        activity_type: log.action,
        occurred_at: log.created_at,
        metadata: log.data
      })));
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load activity logs",
        variant: "destructive"
      });
    }
  };

  const handleAddMember = async () => {
    if (isAdding) return;
    if (!newMember.full_name || !newMember.email || !newMember.role) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Prevent admins from adding other admins
    if (newMember.role === 'admin' || newMember.role === 'superadmin') {
      toast({
        title: "Error",
        description: "You don't have permission to add admin users",
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

    setIsAdding(true);

    try {
      // Use the enhanced edge function for proper auth user creation and email delivery
      const response = await supabase.functions.invoke('create-enhanced-team-member', {
        body: {
          email: newMember.email.toLowerCase().trim(),
          full_name: newMember.full_name.trim(),
          role: newMember.role
        }
      });

      if (response.error) {
        let errorMessage = 'Failed to create team member';
        if (response.error.message) {
          try {
            const errorData = JSON.parse(response.error.message);
            errorMessage = errorData.error || errorData.message || response.error.message;
          } catch {
            errorMessage = response.error.message;
          }
        }

        if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('email_exists')) {
          toast({
            title: "Email Already Registered",
            description: "This email is already registered in the system.",
            variant: "destructive"
          });
          return;
        }
        throw new Error(errorMessage);
      }

      if (!response.data?.success) {
        const errorMsg = response.data?.error || 'Failed to create team member';
        if (errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('email_exists')) {
          toast({
            title: "Email Already Registered",
            description: "This email is already registered in the system.",
            variant: "destructive"
          });
          return;
        }
        throw new Error(errorMsg);
      }

      // Trigger email processing
      try {
        await supabase.functions.invoke('process-email-queue');
        toast({
          title: "Success",
          description: `${newMember.role} account created and credentials sent to ${newMember.email}`
        });
      } catch (emailError) {
        toast({
          title: "Warning",
          description: `Account created but failed to send credential email. Password: ${response.data?.generated_password || 'Contact admin'}`,
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

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    console.log('[AdminTeams] Starting deletion for:', { memberId, memberName });
    try {
      const success = await deleteUser(memberId);
      console.log('[AdminTeams] Deletion result:', success);
      
      if (success) {
        toast({
          title: "Success",
          description: `${memberName} has been deleted successfully`
        });
        fetchTeamMembers();
      }
    } catch (error) {
      console.error('[AdminTeams] Error in handleDeleteMember:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during deletion"
      });
    }
  };

  const handleViewActivity = (member: TeamMember) => {
    setSelectedMember(member);
    setIsActivityDialogOpen(true);
    fetchActivityLogs(member.id);
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const mentorCount = teamMembers.filter(m => m.role === 'mentor').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <Input
                  id="name"
                  value={newMember.full_name}
                  onChange={(e) => setNewMember({...newMember, full_name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select value={newMember.role} onValueChange={(value) => setNewMember({...newMember, role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === 'Active' ? 'default' : 'destructive'}>
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.last_active_at ? new Date(member.last_active_at).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewActivity(member)}
                      >
                        <Activity className="w-4 h-4 mr-1" />
                        Activity
                      </Button>
                      
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
                            <AlertDialogAction
                              onClick={() => handleDeleteMember(member.id, member.full_name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Logs Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Activity Logs - {selectedMember?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.activity_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.metadata ? JSON.stringify(log.metadata) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTeams;
