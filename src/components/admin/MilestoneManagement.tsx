import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Trophy, Users, Award, BarChart3, Settings, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMilestones, type Milestone, type MilestoneCategory } from '@/hooks/useMilestones';
import { safeLogger } from '@/lib/safe-logger';
import { logger } from '@/lib/logger';
const MilestoneForm: React.FC<{
  milestone?: Milestone;
  categories: MilestoneCategory[];
  onSave: () => void;
  onCancel: () => void;
}> = ({
  milestone,
  categories,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    category_id: milestone?.category_id || '',
    name: milestone?.name || '',
    description: milestone?.description || '',
    icon: milestone?.icon || '🏆',
    points: milestone?.points || 10,
    trigger_type: milestone?.trigger_type || 'recording_watched',
    trigger_config: milestone?.trigger_config || {},
    show_celebration: milestone?.show_celebration || false,
    celebration_message: milestone?.celebration_message || '',
    is_active: milestone?.is_active ?? true
  });
  const {
    toast
  } = useToast();
  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        trigger_config: typeof formData.trigger_config === 'string' ? JSON.parse(formData.trigger_config) : formData.trigger_config
      };
      if (milestone) {
        const {
          error
        } = await supabase.from('milestones').update(payload).eq('id', milestone.id);
        if (error) throw error;
        toast({
          title: "Milestone updated successfully!"
        });
      } else {
        const {
          error
        } = await supabase.from('milestones').insert([payload]);
        if (error) throw error;
        toast({
          title: "Milestone created successfully!"
        });
      }
      onSave();
    } catch (error) {
      safeLogger.error('Error saving milestone:', error);
      toast({
        title: "Error saving milestone",
        description: "Please check your input and try again.",
        variant: "destructive"
      });
    }
  };
  return <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category_id} onValueChange={value => setFormData(prev => ({
          ...prev,
          category_id: value
        }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="trigger_type">Trigger Type</Label>
          <Select value={formData.trigger_type} onValueChange={value => setFormData(prev => ({
          ...prev,
          trigger_type: value
        }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recording_watched">Recording Watched</SelectItem>
              <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
              <SelectItem value="assignment_approved">Assignment Approved</SelectItem>
              <SelectItem value="integration_connected">Integration Connected</SelectItem>
              <SelectItem value="course_completed">Course Completed</SelectItem>
              <SelectItem value="onboarding_completed">Onboarding Completed</SelectItem>
              <SelectItem value="manual">Manual Award</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Milestone Name</Label>
          <Input id="name" value={formData.name} onChange={e => setFormData(prev => ({
          ...prev,
          name: e.target.value
        }))} placeholder="Enter milestone name" />
        </div>

        <div>
          <Label htmlFor="icon">Icon (Emoji)</Label>
          <Input id="icon" value={formData.icon} onChange={e => setFormData(prev => ({
          ...prev,
          icon: e.target.value
        }))} placeholder="🏆" />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={formData.description} onChange={e => setFormData(prev => ({
        ...prev,
        description: e.target.value
      }))} placeholder="Describe what this milestone represents" />
      </div>

      <div>
        <Label htmlFor="points">Points</Label>
        <Input id="points" type="number" value={formData.points} onChange={e => setFormData(prev => ({
        ...prev,
        points: parseInt(e.target.value) || 0
      }))} min="0" />
      </div>

      <div>
        <Label htmlFor="trigger_config">Trigger Configuration (JSON)</Label>
        <Textarea id="trigger_config" value={JSON.stringify(formData.trigger_config, null, 2)} onChange={e => {
        try {
          const config = JSON.parse(e.target.value);
          setFormData(prev => ({
            ...prev,
            trigger_config: config
          }));
        } catch (error) {
          // Keep the raw string for editing
          setFormData(prev => ({
            ...prev,
            trigger_config: e.target.value
          }));
        }
      }} placeholder='{"count": 1}' />
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch id="show_celebration" checked={formData.show_celebration} onCheckedChange={checked => setFormData(prev => ({
          ...prev,
          show_celebration: checked
        }))} />
          <Label htmlFor="show_celebration">Show Celebration Popup</Label>
        </div>

        {formData.show_celebration && <div>
            <Label htmlFor="celebration_message">Celebration Message</Label>
            <Textarea id="celebration_message" value={formData.celebration_message} onChange={e => setFormData(prev => ({
          ...prev,
          celebration_message: e.target.value
        }))} placeholder="Congratulations! You've achieved this milestone!" />
          </div>}

        <div className="flex items-center space-x-2">
          <Switch id="is_active" checked={formData.is_active} onCheckedChange={checked => setFormData(prev => ({
          ...prev,
          is_active: checked
        }))} />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {milestone ? 'Update' : 'Create'} Milestone
        </Button>
      </div>
    </div>;
};
const UserMilestonesTab: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userMilestones, setUserMilestones] = useState<any[]>([]);
  const [availableMilestones, setAvailableMilestones] = useState<Milestone[]>([]);
  const {
    toast
  } = useToast();
  const fetchUsers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('users').select('id, full_name, email, role').eq('role', 'student').order('full_name');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      safeLogger.error('Error fetching users:', error);
    }
  };
  const fetchUserMilestones = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('user_milestones').select(`
          *,
          milestone:milestones(*)
        `).eq('user_id', userId).order('completed_at', {
        ascending: false
      });
      if (error) throw error;
      setUserMilestones(data || []);
    } catch (error) {
      safeLogger.error('Error fetching user milestones:', error);
    }
  };
  const fetchAvailableMilestones = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('milestones').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      setAvailableMilestones(data || []);
    } catch (error) {
      safeLogger.error('Error fetching milestones:', error);
    }
  };
  const awardMilestone = async (milestoneId: string) => {
    if (!selectedUser) return;
    try {
      const {
        error
      } = await supabase.from('user_milestones').insert([{
        user_id: selectedUser,
        milestone_id: milestoneId,
        awarded_by: (await supabase.auth.getUser()).data.user?.id,
        notes: 'Manually awarded by admin'
      }]);
      if (error) throw error;
      toast({
        title: "Milestone awarded successfully!"
      });
      fetchUserMilestones(selectedUser);
    } catch (error) {
      safeLogger.error('Error awarding milestone:', error);
      toast({
        title: "Error awarding milestone",
        description: "This user may already have this milestone.",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    fetchUsers();
    fetchAvailableMilestones();
  }, []);
  useEffect(() => {
    if (selectedUser) {
      fetchUserMilestones(selectedUser);
    }
  }, [selectedUser]);
  const completedMilestoneIds = userMilestones.map(um => um.milestone_id);
  const availableToAward = availableMilestones.filter(m => !completedMilestoneIds.includes(m.id));
  return <div className="space-y-6">
      <div>
        <Label>Select Student</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => <SelectItem key={user.id} value={user.id}>
                {user.full_name} ({user.email})
              </SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedUser && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Completed Milestones</CardTitle>
              <CardDescription>
                {userMilestones.length} milestones achieved
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {userMilestones.map(um => <div key={um.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{um.milestone?.icon}</span>
                      <div>
                        <p className="font-medium">{um.milestone?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(um.completed_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{um.milestone?.points} pts</Badge>
                  </div>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Award New Milestone</CardTitle>
              <CardDescription>
                Manually award milestones to this student
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableToAward.map(milestone => <div key={milestone.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{milestone.icon}</span>
                      <div>
                        <p className="font-medium">{milestone.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => awardMilestone(milestone.id)}>
                      Award
                    </Button>
                  </div>)}
                {availableToAward.length === 0 && <p className="text-muted-foreground text-center py-4">
                    This student has completed all available milestones!
                  </p>}
              </div>
            </CardContent>
          </Card>
        </div>}
    </div>;
};
const MilestoneAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState({
    totalMilestones: 0,
    activeMilestones: 0,
    totalAchievements: 0,
    uniqueAchievers: 0,
    recentAchievements: [] as any[],
    topMilestones: [] as any[],
    categoryStats: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchAnalytics();
  }, []);
  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch milestone counts
      const {
        data: milestones
      } = await supabase.from('milestones').select('id, name, is_active, category_id');
      const totalMilestones = milestones?.length || 0;
      const activeMilestones = milestones?.filter(m => m.is_active).length || 0;

      // Fetch user milestone achievements
      const {
        data: achievements
      } = await supabase.from('user_milestones').select(`
          id,
          milestone_id,
          user_id,
          completed_at,
          milestones!inner(name, category_id),
          users!inner(full_name)
        `).order('completed_at', {
        ascending: false
      });
      const totalAchievements = achievements?.length || 0;
      const uniqueAchievers = new Set(achievements?.map(a => a.user_id)).size;

      // Recent achievements (last 10)
      const recentAchievements = achievements?.slice(0, 10) || [];

      // Top milestones by achievement count
      const milestoneAchievementCounts = milestones?.map(milestone => {
        const count = achievements?.filter(a => a.milestone_id === milestone.id).length || 0;
        return {
          name: milestone.name,
          achievements: count
        };
      }).sort((a, b) => b.achievements - a.achievements).slice(0, 5) || [];

      // Category statistics
      const {
        data: categories
      } = await supabase.from('milestone_categories').select('id, name');
      const categoryStats = categories?.map(category => {
        const categoryMilestones = milestones?.filter(m => m.category_id === category.id) || [];
        const categoryAchievements = achievements?.filter(a => categoryMilestones.some(m => m.id === a.milestone_id)) || [];
        return {
          name: category.name,
          milestones: categoryMilestones.length,
          achievements: categoryAchievements.length
        };
      }) || [];
      setAnalytics({
        totalMilestones,
        activeMilestones,
        totalAchievements,
        uniqueAchievers,
        recentAchievements,
        topMilestones: milestoneAchievementCounts,
        categoryStats
      });
    } catch (error) {
      logger.error('Error fetching milestone analytics:', error);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center py-8">
        <div className="text-lg">Loading analytics...</div>
      </div>;
  }
  return <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Milestones</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalMilestones}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.activeMilestones} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Achievements</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAchievements}</div>
            <p className="text-xs text-muted-foreground">
              Across all milestones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Achievers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueAchievers}</div>
            <p className="text-xs text-muted-foreground">
              Unique users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.uniqueAchievers > 0 ? Math.round(analytics.totalAchievements / analytics.uniqueAchievers * 10) / 10 : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Achievements per user
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Achievements */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentAchievements.length > 0 ? analytics.recentAchievements.map((achievement, index) => <div key={achievement.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{achievement.users?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.milestones?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(achievement.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>) : <p className="text-center text-muted-foreground py-4">No achievements yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Top Milestones */}
        <Card>
          <CardHeader>
            <CardTitle>Most Achieved Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topMilestones.length > 0 ? analytics.topMilestones.map((milestone, index) => <div key={milestone.name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{milestone.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {milestone.achievements} achievements
                      </p>
                    </div>
                  </div>) : <p className="text-center text-muted-foreground py-4">No data available</p>}
            </div>
          </CardContent>
        </Card>

        {/* Category Statistics */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.categoryStats.length > 0 ? analytics.categoryStats.map(category => <div key={category.name} className="p-4 rounded-lg border">
                    <h4 className="font-medium">{category.name}</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {category.milestones} milestones
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {category.achievements} achievements
                      </p>
                    </div>
                  </div>) : <p className="text-center text-muted-foreground py-4 col-span-full">No categories available</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export const MilestoneManagement: React.FC = () => {
  const {
    categories,
    milestones,
    loading,
    refreshMilestones
  } = useMilestones();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const {
    toast
  } = useToast();
  const deleteMilestone = async (milestoneId: string) => {
    try {
      const {
        error
      } = await supabase.from('milestones').delete().eq('id', milestoneId);
      if (error) throw error;
      toast({
        title: "Milestone deleted successfully!"
      });
      refreshMilestones();
    } catch (error) {
      safeLogger.error('Error deleting milestone:', error);
      toast({
        title: "Error deleting milestone",
        variant: "destructive"
      });
    }
  };
  const toggleMilestoneActive = async (milestoneId: string, isActive: boolean) => {
    try {
      const {
        error
      } = await supabase.from('milestones').update({
        is_active: !isActive
      }).eq('id', milestoneId);
      if (error) throw error;
      refreshMilestones();
    } catch (error) {
      safeLogger.error('Error toggling milestone status:', error);
    }
  };
  if (loading) {
    return <div className="text-center py-8">Loading milestones...</div>;
  }
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Milestone Management</h1>
          <p className="text-muted-foreground">
            Manage student milestones and celebrations
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Milestone
        </Button>
      </div>

      <Tabs defaultValue="milestones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="milestones">
            <Trophy className="w-4 h-4 mr-2" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="user-milestones">
            <Users className="w-4 h-4 mr-2" />
            Student Progress
          </TabsTrigger>
          
        </TabsList>

        <TabsContent value="milestones" className="space-y-4">
          <div className="grid gap-4">
            {categories.map(category => {
            const categoryMilestones = milestones.filter(m => m.category_id === category.id);
            return <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                      <Badge variant="outline">{categoryMilestones.length} milestones</Badge>
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {categoryMilestones.map(milestone => <div key={milestone.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{milestone.icon}</span>
                            <div>
                              <h4 className="font-medium">{milestone.name}</h4>
                              <p className="text-sm text-muted-foreground">{milestone.description}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {milestone.points} pts
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {milestone.trigger_type.replace('_', ' ')}
                                </Badge>
                                {milestone.show_celebration && <Badge variant="default" className="text-xs">
                                    🎉 Celebration
                                  </Badge>}
                                {!milestone.is_active && <Badge variant="destructive" className="text-xs">
                                    Inactive
                                  </Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => toggleMilestoneActive(milestone.id, milestone.is_active)}>
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingMilestone(milestone)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteMilestone(milestone.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>)}
                    </div>
                  </CardContent>
                </Card>;
          })}
          </div>
        </TabsContent>

        <TabsContent value="user-milestones">
          <UserMilestonesTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <MilestoneAnalytics />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Milestone</DialogTitle>
            <DialogDescription>
              Create a new milestone that students can achieve
            </DialogDescription>
          </DialogHeader>
          <MilestoneForm categories={categories} onSave={() => {
          setShowCreateDialog(false);
          refreshMilestones();
        }} onCancel={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMilestone} onOpenChange={() => setEditingMilestone(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>
              Update milestone details and configuration
            </DialogDescription>
          </DialogHeader>
          {editingMilestone && <MilestoneForm milestone={editingMilestone} categories={categories} onSave={() => {
          setEditingMilestone(null);
          refreshMilestones();
        }} onCancel={() => setEditingMilestone(null)} />}
        </DialogContent>
      </Dialog>
    </div>;
};
