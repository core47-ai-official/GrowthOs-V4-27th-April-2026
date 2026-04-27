import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyContentUnlocked } from '@/utils/notifyContentUnlocked';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Lock, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SequentialUnlockSettings {
  isEnabled: boolean;
  totalStudents: number;
  studentsWithFeesCleared: number;
  firstRecordingId?: string;
  firstRecordingTitle?: string;
}

export const SequentialUnlockAdmin: React.FC = () => {
  const [settings, setSettings] = useState<SequentialUnlockSettings>({
    isEnabled: false,
    totalStudents: 0,
    studentsWithFeesCleared: 0
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Get current flag status
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('lms_sequential_unlock')
        .eq('id', 1)
        .single();

      // Get student statistics
      const { data: studentStats } = await supabase
        .from('students')
        .select('fees_cleared, user_id');

      // Get first recording info
      const { data: firstRecording } = await supabase
        .from('available_lessons')
        .select('id, recording_title')
        .order('sequence_order', { ascending: true })
        .limit(1)
        .single();

      const isEnabled = companyData?.lms_sequential_unlock || false;
      const totalStudents = studentStats?.length || 0;
      const studentsWithFeesCleared = studentStats?.filter(s => s.fees_cleared).length || 0;

      setSettings({
        isEnabled,
        totalStudents,
        studentsWithFeesCleared,
        firstRecordingId: firstRecording?.id,
        firstRecordingTitle: firstRecording?.recording_title
      });

    } catch (error) {
      console.error('Error fetching sequential unlock settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sequential unlock settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSequentialUnlock = async (enabled: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ lms_sequential_unlock: enabled })
        .eq('id', 1);

      if (error) throw error;

      setSettings(prev => ({ ...prev, isEnabled: enabled }));
      
      toast({
        title: 'Settings Updated',
        description: `Sequential unlock ${enabled ? 'enabled' : 'disabled'} successfully`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Error updating sequential unlock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update sequential unlock setting',
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const initializeFirstRecordingUnlocks = async () => {
    if (!settings.firstRecordingId) return;

    setUpdating(true);
    try {
      // Get all students with fees cleared
      const { data: eligibleStudents } = await supabase
        .from('students')
        .select('user_id')
        .eq('fees_cleared', true);

      if (!eligibleStudents?.length) {
        toast({
          title: 'No Eligible Students',
          description: 'No students have fees cleared yet',
          variant: 'default'
        });
        return;
      }

      // Unlock first recording for all eligible students
      const unlockPromises = eligibleStudents.map(student => 
        supabase
          .from('user_unlocks')
          .upsert({
            user_id: student.user_id,
            recording_id: settings.firstRecordingId!,
            is_unlocked: true,
            unlocked_at: new Date().toISOString()
          })
      );

      await Promise.all(unlockPromises);

      // Send unlock notification to each student
      for (const student of eligibleStudents) {
        notifyContentUnlocked(student.user_id, settings.firstRecordingId!);
      }

      toast({
        title: 'Initialization Complete',
        description: `First recording unlocked for ${eligibleStudents.length} students`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Error initializing unlocks:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize first recording unlocks',
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading sequential unlock settings...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Sequential Unlock System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Feature Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-medium">Enable Sequential Unlock</h3>
              <p className="text-sm text-muted-foreground">
                Students must complete recordings and assignments in order
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.isEnabled}
                onCheckedChange={toggleSequentialUnlock}
                disabled={updating}
              />
              <Badge variant={settings.isEnabled ? 'default' : 'secondary'}>
                {settings.isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Student Statistics</h4>
              <div className="text-sm text-muted-foreground">
                <div>Total Students: {settings.totalStudents}</div>
                <div>Fees Cleared: {settings.studentsWithFeesCleared}</div>
                <div>Pending: {settings.totalStudents - settings.studentsWithFeesCleared}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">First Recording</h4>
              <div className="text-sm text-muted-foreground">
                {settings.firstRecordingTitle || 'No recordings found'}
              </div>
            </div>
          </div>

          {/* Warnings and Information */}
          {settings.isEnabled && (
            <Alert>
              <Lock className="w-4 h-4" />
              <AlertDescription>
                Sequential unlock is <strong>ENABLED</strong>. Students can only access recordings 
                after completing previous assignments. When disabled, all recordings follow 
                existing unlock behavior (zero regression).
              </AlertDescription>
            </Alert>
          )}

          {!settings.isEnabled && (
            <Alert>
              <Unlock className="w-4 h-4" />
              <AlertDescription>
                Sequential unlock is <strong>DISABLED</strong>. All recordings use existing 
                unlock behavior. No changes to current student experience.
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Actions */}
          {settings.isEnabled && settings.firstRecordingId && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Quick Actions</h4>
              <button
                onClick={initializeFirstRecordingUnlocks}
                disabled={updating || settings.studentsWithFeesCleared === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 text-sm"
              >
                {updating ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Initializing...</>
                ) : (
                  `Unlock First Recording for ${settings.studentsWithFeesCleared} Students`
                )}
              </button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Implementation Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Zero Regression:</strong> When disabled, existing unlock behavior is preserved</p>
          <p>• <strong>Fees Required:</strong> Students need fees_cleared=true to access first recording</p>
          <p>• <strong>Strict Sequence:</strong> Each recording must be watched and assignment approved before next unlock</p>
          <p>• <strong>Resubmission:</strong> Latest submission status determines unlock progression</p>
          <p>• <strong>Real-time:</strong> Status updates immediately after assignment review</p>
        </CardContent>
      </Card>
    </div>
  );
};