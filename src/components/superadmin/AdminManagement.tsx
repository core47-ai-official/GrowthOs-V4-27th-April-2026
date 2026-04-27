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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Activity, Key, Trash2, UserPlus, Shield } from 'lucide-react';
import { ActivityLogsDialog } from '@/components/ActivityLogsDialog';
import { CredentialDisplay } from '@/components/ui/credential-display';
import { generateSecurePassword } from '@/utils/passwordGenerator';
import { logger } from '@/lib/logger';


interface Admin {
  id: string;
  full_name: string;
  email: string;
  role: string;
  lms_user_id: string;
  created_at: string;
  last_active_at: string;
  status: string;
}

export const AdminManagement = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [newAdmin, setNewAdmin] = useState({
    full_name: '',
    email: ''
  });
  const { toast } = useToast();

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load admins",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const handleAddAdmin = async () => {
    if (!newAdmin.full_name || !newAdmin.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try { const corrId = `admin-create-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const t0 = performance.now();
      // Generate a secure temporary password
      const tempPassword = generateSecurePassword();
      
      const tInvokeStart = performance.now();
      const response = await supabase.functions.invoke('create-team-member', {
        body: {
          email: newAdmin.email,
          full_name: newAdmin.full_name,
          role: 'admin',
          temp_password: tempPassword
        },
        headers: { 'x-correlation-id': corrId }
      });
      logger.performance('edge.create_team_member', performance.now() - tInvokeStart, { corrId });

      if (response.error) {
        console.error('Error creating admin:', response.error);
        throw new Error(response.error.message || 'Failed to create admin');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to create admin');
      }

      toast({
        title: "Success",
        description: `Admin account created successfully`
      });

      setNewAdmin({
        full_name: '',
        email: ''
      });
      setIsAddDialogOpen(false);
      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add admin: " + error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    try {
      // Delete from users table
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', adminId);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `${adminName} has been deleted successfully`
      });

      fetchAdmins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete admin: " + error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Admin Management</h2>
            <p className="text-muted-foreground">Manage system administrators</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Administrator</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="admin_name">Full Name *</Label>
                <Input
                  id="admin_name"
                  value={newAdmin.full_name}
                  onChange={(e) => setNewAdmin({...newAdmin, full_name: e.target.value})}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="admin_email">Email *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              <Button onClick={handleAddAdmin} className="w-full">
                Create Admin Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Total Administrators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{admins.length}</div>
          <p className="text-sm text-muted-foreground mt-1">
            Active system administrators
          </p>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Administrators</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No administrators found</p>
              <p className="text-sm text-muted-foreground">Add your first admin to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.full_name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.status === 'Active' ? 'default' : 'destructive'}>
                        {admin.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {admin.last_active_at ? new Date(admin.last_active_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog open={credentialDialogOpen && selectedAdmin?.id === admin.id} 
                               onOpenChange={(open) => {
                                 setCredentialDialogOpen(open);
                                 if (!open) setSelectedAdmin(null);
                               }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedAdmin(admin)}
                            >
                              <Key className="w-4 h-4 mr-1" />
                              Credentials
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Login Credentials - {admin.full_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm font-medium">Email</Label>
                                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded">{admin.email}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Access</Label>
                                <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                                  Credentials are securely managed through the system
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <ActivityLogsDialog userId={admin.id} userName={admin.full_name}>
                          <Button variant="outline" size="sm">
                            <Activity className="w-4 h-4 mr-1" />
                            Activity
                          </Button>
                        </ActivityLogsDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {admin.full_name} and remove all their data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteAdmin(admin.id, admin.full_name)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};