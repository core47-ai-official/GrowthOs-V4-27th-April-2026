import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Target, Zap, RefreshCw, Star, Award } from "lucide-react";
import { toast } from "sonner";

interface LeaderboardSnapshot {
  id: string;
  user_id: string;
  display_name: string;
  avatar_initials: string;
  score: number;
  progress: number;
  videos_watched: number;
  assignments_completed: number;
  milestones_completed: number;
  sessions_attended: number;
  has_shopify: boolean;
  has_meta: boolean;
  streak: number;
  rank: number;
  calculated_at: string;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardSnapshot | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBatchId, setUserBatchId] = useState<string | null>(null);
  const [batchName, setBatchName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserRole();
      fetchUserBatch();
    }
  }, [user]);

  // Fetch leaderboard after batch info is resolved
  useEffect(() => {
    if (user && userRole !== null) {
      fetchLeaderboardData();
    }
  }, [user, userRole, userBatchId]);

  const fetchUserRole = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    setUserRole(data?.role || null);
  };

  const fetchUserBatch = async () => {
    if (!user) return;
    try {
      // Get student record
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!student) {
        setUserBatchId(null);
        return;
      }

      // Get active enrollment with batch
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('batch_id')
        .eq('student_id', student.id)
        .eq('status', 'active')
        .not('batch_id', 'is', null)
        .maybeSingle();

      const batchId = enrollment?.batch_id || null;
      setUserBatchId(batchId);

      if (batchId) {
        const { data: batch } = await supabase
          .from('batches')
          .select('name')
          .eq('id', batchId)
          .single();
        setBatchName(batch?.name || null);
      }
    } catch (error) {
      console.error('[Leaderboard] Error fetching batch:', error);
      setUserBatchId(null);
    }
  };

  // Throttle helpers for auto-build
  const shouldThrottle = () => {
    const lastBuildTs = Number(localStorage.getItem('leaderboard:lastBuildTs') || '0');
    return Date.now() - lastBuildTs < 5 * 60 * 1000; // 5 minutes
  };

  const markThrottle = () => {
    localStorage.setItem('leaderboard:lastBuildTs', String(Date.now()));
  };

  const ensureLeaderboardBuilt = async () => {
    if (shouldThrottle()) {
      console.log('[Leaderboard] Build throttled (called within last 5 minutes)');
      return false;
    }

    toast.info('Building leaderboard...');
    const { error } = await supabase.functions.invoke('build-leaderboard');
    
    if (error) {
      console.error('[Leaderboard] Build failed:', error);
      toast.error('Failed to build leaderboard');
      return false;
    }

    markThrottle();
    console.log('[Leaderboard] Build successful, waiting 1s before refetch');
    await new Promise(r => setTimeout(r, 1000));
    await fetchLeaderboardData();
    toast.success('Leaderboard updated!');
    return true;
  };

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);

      // Fetch all leaderboard snapshots
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('leaderboard_snapshots')
        .select('*')
        .order('rank', { ascending: true });

      if (snapshotsError) {
        console.error('[Leaderboard] Error fetching:', snapshotsError);
        toast.error('Failed to load leaderboard');
        return;
      }

      console.log(`[Leaderboard] Fetched ${snapshots?.length || 0} snapshots`);

      // Auto-build if empty
      if (!snapshots || snapshots.length === 0) {
        console.log('[Leaderboard] Empty data detected, triggering auto-build');
        setLoading(false);
        await ensureLeaderboardBuilt();
        return;
      }

      // Check staleness (if newest snapshot is older than 10 minutes, auto-rebuild)
      const newestSnapshot = snapshots[0];
      const calculatedAt = new Date(newestSnapshot.calculated_at).getTime();
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      
      if (calculatedAt < tenMinutesAgo) {
        console.log('[Leaderboard] Stale data detected (>10 min old), triggering background rebuild');
        ensureLeaderboardBuilt();
      }

      // For students with a batch, filter to only batch-mates and re-rank
      const isStudent = userRole === 'student';
      let filteredSnapshots = snapshots || [];

      if (isStudent && userBatchId) {
        // Get all student_ids in the same batch
        const { data: batchEnrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .eq('batch_id', userBatchId)
          .eq('status', 'active');

        if (batchEnrollments && batchEnrollments.length > 0) {
          // student_id in course_enrollments maps to user_id in users table via students table
          const { data: batchStudents } = await supabase
            .from('students')
            .select('user_id')
            .in('id', batchEnrollments.map(e => e.student_id));

          const batchUserIds = new Set(batchStudents?.map(s => s.user_id) || []);
          
          // Filter snapshots to batch members only
          filteredSnapshots = snapshots.filter(s => batchUserIds.has(s.user_id));
          
          // Re-sort by score/progress and assign batch-scoped ranks
          filteredSnapshots.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.progress - a.progress;
          });
          filteredSnapshots = filteredSnapshots.map((s, i) => ({ ...s, rank: i + 1 }));
        }
      }

      setLeaderboardData(filteredSnapshots);
      setTotalStudents(filteredSnapshots.length);

      // Find current user's stats (with batch-scoped rank)
      const userStats = filteredSnapshots.find(s => s.user_id === user?.id);
      setCurrentUserStats(userStats || null);

    } catch (error) {
      console.error('[Leaderboard] Error in fetchLeaderboardData:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRebuildLeaderboard = async () => {
    try {
      setRebuilding(true);
      toast.info('Rebuilding leaderboard...');

      const { error } = await supabase.functions.invoke('build-leaderboard');

      if (error) {
        console.error('Error rebuilding leaderboard:', error);
        toast.error('Failed to rebuild leaderboard');
        return;
      }

      toast.success('Leaderboard rebuilt successfully!');
      
      // Refetch data after a short delay
      setTimeout(() => {
        fetchLeaderboardData();
      }, 1000);

    } catch (error) {
      console.error('Error rebuilding leaderboard:', error);
      toast.error('Failed to rebuild leaderboard');
    } finally {
      setRebuilding(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leaderboard 🏆</h1>
            <p className="text-muted-foreground mt-2">
              {batchName 
                ? `Ranking within Batch ${batchName}` 
                : 'See how you stack up against fellow students'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalStudents}</div>
                <div className="text-sm text-muted-foreground">Active Students</div>
              </div>
            </Card>

            {(userRole === 'admin' || userRole === 'superadmin') && (
              <Button 
                onClick={handleRebuildLeaderboard}
                disabled={rebuilding}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? 'Rebuilding...' : 'Rebuild'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Leaderboard */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading leaderboard...</div>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-muted mx-auto mb-3" />
                  <div className="text-muted-foreground mb-4">No leaderboard data yet</div>
                  <Button 
                    onClick={async () => {
                      setRebuilding(true);
                      await ensureLeaderboardBuilt();
                      setRebuilding(false);
                    }}
                    disabled={rebuilding}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                    {rebuilding ? 'Building...' : 'Build Leaderboard'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboardData.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={`p-4 rounded-lg border transition-all ${
                        entry.user_id === user?.id
                          ? 'bg-primary/5 border-primary/20 shadow-md'
                          : 'hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl font-bold min-w-[40px]">
                            {getRankIcon(entry.rank) || `#${entry.rank}`}
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {entry.avatar_initials}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div>
                              <h3 className={`font-semibold ${entry.user_id === user?.id ? 'text-primary' : ''}`}>
                                {entry.display_name}
                              </h3>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                {entry.streak > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Zap className="h-3 w-3 text-yellow-500" />
                                    {entry.streak} day streak
                                  </span>
                                )}
                                {entry.sessions_attended > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>📅 {entry.sessions_attended} sessions</span>
                                  </>
                                )}
                              </div>
                              {(entry.has_shopify || entry.has_meta) && (
                                <div className="flex gap-1 mt-1">
                                  {entry.has_shopify && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300">
                                      🛒 Shopify
                                    </Badge>
                                  )}
                                  {entry.has_meta && (
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                      📊 Meta
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {entry.score}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.progress}% complete
                          </div>
                        </div>
                      </div>
                      
                      <Progress value={entry.progress} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Your Stats */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2" />
                Your Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentUserStats ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Current Rank</span>
                    <span className="font-bold">#{currentUserStats.rank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score</span>
                    <span className="font-bold">{currentUserStats.score}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Progress</span>
                    <span className="font-bold">{currentUserStats.progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Videos Watched</span>
                    <span className="font-bold">{currentUserStats.videos_watched}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assignments</span>
                    <span className="font-bold">{currentUserStats.assignments_completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sessions Joined</span>
                    <span className="font-bold">{currentUserStats.sessions_attended}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Streak</span>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4 text-yellow-300" />
                      <span className="font-bold">{currentUserStats.streak} days</span>
                    </div>
                  </div>
                  {currentUserStats.has_shopify && (
                    <div className="flex items-center text-sm">
                      <span>✓ Shopify Connected</span>
                    </div>
                  )}
                  {currentUserStats.has_meta && (
                    <div className="flex items-center text-sm">
                      <span>✓ Meta Ads Connected</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-sm opacity-80">
                  Complete activities to see your stats
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integrations Badge */}
          {currentUserStats && (currentUserStats.has_shopify || currentUserStats.has_meta) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="w-5 h-5 mr-2 text-purple-600" />
                  Your Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {currentUserStats.has_shopify && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300 px-3 py-1">
                      🛒 Shopify Connected
                    </Badge>
                  )}
                  {currentUserStats.has_meta && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-3 py-1">
                      📊 Meta Ads Connected
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
