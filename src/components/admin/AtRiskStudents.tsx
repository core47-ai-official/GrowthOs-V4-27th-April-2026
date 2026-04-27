import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Search, StickyNote, User, Settings, LogIn, Video, FileText, Calendar, ArrowUpDown, ChevronDown, CheckCircle, Users, Mail, MessageCircle, ExternalLink, BellRing, UserPlus, Clock, TrendingUp, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 25;
import { useAtRiskRules, AtRiskRules } from '@/hooks/useAtRiskRules';
import { useAtRiskStudents, AtRiskReason, AtRiskStudent } from '@/hooks/useAtRiskStudents';
import { useAtRiskMentors, MentorInfo } from '@/hooks/useAtRiskMentors';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { composeOutreachMessage, buildMailtoLink, buildWhatsAppLink, notifyMentorOfAtRiskStudent } from '@/lib/at-risk-actions';

const reasonIcons: Record<AtRiskReason, React.ReactNode> = {
  no_login: <LogIn className="h-3.5 w-3.5" />,
  stuck_recording: <Video className="h-3.5 w-3.5" />,
  stuck_assignment: <FileText className="h-3.5 w-3.5" />,
  missed_sessions: <Calendar className="h-3.5 w-3.5" />,
};

const reasonColors: Record<AtRiskReason, string> = {
  no_login: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
  stuck_recording: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  stuck_assignment: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  missed_sessions: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
};

function getDaysAtRiskBadge(days?: number): { label: string; className: string } {
  if (days === undefined || days === null) return { label: 'New', className: 'bg-muted text-muted-foreground' };
  if (days === 0) return { label: 'New today', className: 'bg-muted text-muted-foreground' };
  if (days < 3) return { label: `${days}d`, className: 'bg-muted text-muted-foreground' };
  if (days <= 7) return { label: `${days}d`, className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300' };
  return { label: `${days}d`, className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300' };
}

function AtRiskRulesConfig({ rules, configured, onSave }: { rules: AtRiskRules; configured: boolean; onSave: (r: AtRiskRules) => Promise<boolean> }) {
  const [draft, setDraft] = useState<AtRiskRules>(rules);

  useEffect(() => {
    setDraft(rules);
  }, [rules]);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(!configured);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) {
      toast({ title: 'Rules saved', description: 'At-risk detection rules have been updated.' });
      setIsOpen(false);
    } else {
      toast({ title: 'Error', description: 'Failed to save rules.', variant: 'destructive' });
    }
  };

  const rulesSummary = [
    { icon: <LogIn className="h-3.5 w-3.5" />, label: 'No Login', value: rules.no_login_days, unit: 'days' },
    { icon: <Video className="h-3.5 w-3.5" />, label: 'Stuck Recording', value: rules.stuck_recording_days, unit: 'days' },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'Stuck Assignment', value: rules.stuck_assignment_days, unit: 'days' },
    { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Missed Sessions', value: rules.missed_sessions_count, unit: '' },
  ].filter(r => r.value > 0);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="cursor-pointer">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                Detection Rules
              </CardTitle>
              <div className="flex items-center gap-3">
                {!isOpen && configured && rulesSummary.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {rulesSummary.map((r, i) => (
                      <Badge key={i} variant="outline" className="gap-1 text-xs">
                        {r.icon}
                        {r.label}: {r.value}{r.unit ? ` ${r.unit}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <LogIn className="h-4 w-4 text-orange-600" />
                  No Login (days)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.no_login_days}
                  onChange={(e) => setDraft(d => ({ ...d, no_login_days: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 7"
                />
                <p className="text-xs text-muted-foreground">Flag if no login for this many days</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Video className="h-4 w-4 text-blue-600" />
                  Stuck Recording (days)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.stuck_recording_days}
                  onChange={(e) => setDraft(d => ({ ...d, stuck_recording_days: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 5"
                />
                <p className="text-xs text-muted-foreground">No new recording watched</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <FileText className="h-4 w-4 text-purple-600" />
                  Stuck Assignment (days)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.stuck_assignment_days}
                  onChange={(e) => setDraft(d => ({ ...d, stuck_assignment_days: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 5"
                />
                <p className="text-xs text-muted-foreground">No assignment submitted</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-4 w-4 text-red-600" />
                  Missed Sessions (count)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.missed_sessions_count}
                  onChange={(e) => setDraft(d => ({ ...d, missed_sessions_count: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 3"
                />
                <p className="text-xs text-muted-foreground">Recent sessions missed</p>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Rules'}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface PastNote {
  id: string;
  note: string;
  created_at: string;
  created_by_name: string;
}

function AddNoteDialog({ studentId, studentName, onNoteSaved }: { studentId: string; studentName: string; onNoteSaved: () => void }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [pastNotes, setPastNotes] = useState<PastNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && studentId) fetchPastNotes();
  }, [open, studentId]);

  const fetchPastNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data } = await supabase
        .from('user_activity_logs')
        .select('id, metadata, occurred_at')
        .eq('user_id', studentId)
        .eq('activity_type', 'admin_note')
        .like('metadata->>note', '%[At-Risk Note]%')
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (!data?.length) { setPastNotes([]); setLoadingNotes(false); return; }

      const creatorIds = [...new Set((data || []).map(d => (d.metadata as any)?.created_by).filter(Boolean))];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length) {
        const { data: creators } = await supabase.from('users').select('id, full_name').in('id', creatorIds);
        creatorMap = Object.fromEntries((creators || []).map(c => [c.id, c.full_name]));
      }

      setPastNotes(data.map(d => {
        const meta = d.metadata as any;
        return {
          id: d.id,
          note: meta?.note || '',
          created_at: d.occurred_at,
          created_by_name: creatorMap[meta?.created_by] || 'System',
        };
      }));
    } catch { setPastNotes([]); }
    finally { setLoadingNotes(false); }
  };

  const handleSave = async () => {
    if (!note.trim() || !user?.id) return;
    setSaving(true);
    try {
      await supabase.from('user_activity_logs').insert({
        user_id: studentId,
        activity_type: 'admin_note',
        occurred_at: new Date().toISOString(),
        metadata: { note: `[At-Risk Note] ${note.trim()}`, created_by: user.id },
      });
      toast({ title: 'Note added', description: `Note saved for ${studentName}` });
      setNote('');
      fetchPastNotes();
      onNoteSaved();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Recovery notes">
          <StickyNote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recovery Notes — {studentName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Add Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What action was taken to help this student? e.g., Called student, sent WhatsApp reminder..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !note.trim()}>
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>

          {loadingNotes ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading notes...</p>
          ) : pastNotes.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Past Notes</Label>
              <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
                {pastNotes.map(n => (
                  <div key={n.id} className="rounded-lg border p-3 space-y-1 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{n.created_by_name}</span>
                      <span>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No previous notes for this student.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignMentorDialog({
  student,
  allMentors,
  currentMentor,
  onAssign,
}: {
  student: AtRiskStudent;
  allMentors: MentorInfo[];
  currentMentor: MentorInfo | null;
  onAssign: (mentorId: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(currentMentor?.id || '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setSelectedId(currentMentor?.id || '');
  }, [open, currentMentor]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onAssign(selectedId || null);
    setSaving(false);
    if (ok) {
      toast({ title: 'Mentor assigned', description: `Mentor updated for ${student.name}` });
      setOpen(false);
    } else {
      toast({ title: 'Error', description: 'Failed to assign mentor', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <UserPlus className="h-3 w-3" />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Mentor — {student.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm">Select mentor</Label>
            <Select value={selectedId || 'unassign'} onValueChange={(v) => setSelectedId(v === 'unassign' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a mentor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">— Unassigned —</SelectItem>
                {allMentors.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name} <span className="text-muted-foreground text-xs">({m.email})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allMentors.length === 0 && (
              <p className="text-xs text-muted-foreground">No mentors found in the system.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotifyMentorButton({
  student,
  mentor,
}: {
  student: AtRiskStudent;
  mentor: MentorInfo;
}) {
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleNotify = async () => {
    if (!user?.id) return;
    setSending(true);
    const result = await notifyMentorOfAtRiskStudent({
      mentorId: mentor.id,
      mentorEmail: mentor.email,
      mentorName: mentor.full_name,
      student,
      triggeredBy: user.id,
    });
    setSending(false);
    if (result.success) {
      toast({ title: 'Mentor notified', description: `${mentor.full_name} was alerted via in-app + email.` });
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to notify mentor', variant: 'destructive' });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleNotify}
      disabled={sending}
      title={`Notify ${mentor.full_name}`}
    >
      <BellRing className="h-3.5 w-3.5" />
    </Button>
  );
}

function StudentTable({
  students,
  search,
  loading,
  emptyMessage,
  showActions = false,
  onRefetch,
  severityFilter,
  sortOrder,
  mentorMap,
  allMentors,
  onAssignMentor,
}: {
  students: AtRiskStudent[];
  search: string;
  loading: boolean;
  emptyMessage: string;
  showActions?: boolean;
  onRefetch: () => void;
  severityFilter: 'all' | 'critical' | 'warning';
  sortOrder: 'newest' | 'oldest';
  mentorMap: Map<string, MentorInfo | null>;
  allMentors: MentorInfo[];
  onAssignMentor: (studentUserId: string, mentorId: string | null) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const filtered = useMemo(() => students
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.batch_name && s.batch_name.toLowerCase().includes(search.toLowerCase()));
      const matchesSeverity = severityFilter === 'all' || s.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      const aDays = a.days_at_risk ?? 0;
      const bDays = b.days_at_risk ?? 0;
      if (sortOrder === 'oldest') return aDays - bDays;
      return bDays - aDays;
    }), [students, search, severityFilter, sortOrder]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset to first page when filters change or list shrinks below current page
  useEffect(() => {
    setPage(1);
  }, [search, severityFilter, sortOrder]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{search ? 'No students match your search.' : emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const isPending = showActions;

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Severity</TableHead>
                {isPending && <TableHead>Days at Risk</TableHead>}
                {isPending && <TableHead>Mentor</TableHead>}
                {students[0]?.resolved_at && <TableHead>Resolved On</TableHead>}
                {showActions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((student) => {
                const mentor = mentorMap.get(student.user_id) || null;
                const aging = getDaysAtRiskBadge(student.days_at_risk);

                return (
                  <TableRow key={student.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.batch_name ? (
                        <Badge variant="outline">{student.batch_name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {student.reasons.map((r, i) => (
                          <Badge key={i} variant="outline" className={`gap-1 ${reasonColors[r.type]}`}>
                            {reasonIcons[r.type]}
                            <span className="text-xs">{r.detail}</span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {student.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}
                      </Badge>
                    </TableCell>
                    {isPending && (
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${aging.className}`}>
                          <Clock className="h-3 w-3" />
                          {aging.label}
                        </Badge>
                      </TableCell>
                    )}
                    {isPending && (
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {mentor ? (
                            <>
                              <span className="text-sm font-medium truncate max-w-[140px]" title={mentor.full_name}>
                                {mentor.full_name}
                              </span>
                              <NotifyMentorButton student={student} mentor={mentor} />
                              <AssignMentorDialog
                                student={student}
                                allMentors={allMentors}
                                currentMentor={mentor}
                                onAssign={(mid) => onAssignMentor(student.user_id, mid)}
                              />
                            </>
                          ) : (
                            <AssignMentorDialog
                              student={student}
                              allMentors={allMentors}
                              currentMentor={null}
                              onAssign={(mid) => onAssignMentor(student.user_id, mid)}
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {student.resolved_at && (
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(student.resolved_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                    )}
                    {showActions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Email */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
                                <a
                                  href={(() => {
                                    const { subject, body } = composeOutreachMessage(student, 'email');
                                    return buildMailtoLink(student.email, subject, body);
                                  })()}
                                >
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Email student (pre-filled)</TooltipContent>
                          </Tooltip>

                          {/* WhatsApp */}
                          {student.phone ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a
                                    href={buildWhatsAppLink(
                                      student.phone,
                                      composeOutreachMessage(student, 'whatsapp').body
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>WhatsApp (pre-filled)</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-40 cursor-not-allowed"
                                    disabled
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>No phone number on file</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Profile - opens Students Management in a new tab pre-filtered by this student */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  const basePath = user?.role === 'superadmin' ? '/superadmin' : '/admin';
                                  const query = encodeURIComponent(student.email || student.phone || '');
                                  window.open(`${basePath}?tab=students&search=${query}`, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View profile (opens in new tab)</TooltipContent>
                          </Tooltip>

                          {/* Note */}
                          <AddNoteDialog
                            studentId={student.user_id}
                            studentName={student.name}
                            onNoteSaved={onRefetch}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>
              {'–'}
              <span className="font-medium text-foreground">{Math.min(page * PAGE_SIZE, filtered.length)}</span>
              {' of '}
              <span className="font-medium text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span> of{' '}
                <span className="font-medium text-foreground">{totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}

interface KpiData {
  totalActive: number;
  recoveredThisWeek: number;
  avgDaysToRecover: number | null;
  recoveryRatePct: number | null;
}

function useKpis(students: AtRiskStudent[], resolvedByTeam: AtRiskStudent[], resolvedByStudent: AtRiskStudent[]): KpiData {
  return useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;

    const allResolved = [...resolvedByTeam, ...resolvedByStudent];
    const recoveredThisWeek = allResolved.filter(s => s.resolved_at && new Date(s.resolved_at).getTime() >= weekAgo).length;

    // Avg days to recover: use resolved_at vs first flag (we don't have the first flag for resolved here,
    // so as a proxy use the last 90d window — ideally we'd compute this from history)
    const avgDaysToRecover = allResolved.length > 0
      ? Math.round(
          allResolved.reduce((sum, s) => {
            // proxy: how many days ago they resolved (lower = faster cleanup cycle)
            if (!s.resolved_at) return sum;
            return sum + Math.max(0, Math.floor((now - new Date(s.resolved_at).getTime()) / 86400000));
          }, 0) / allResolved.length
        )
      : null;

    const totalEverFlagged = students.length + allResolved.length;
    const recoveryRatePct = totalEverFlagged > 0
      ? Math.round((allResolved.length / totalEverFlagged) * 100)
      : null;

    return {
      totalActive: students.length,
      recoveredThisWeek,
      avgDaysToRecover,
      recoveryRatePct,
    };
  }, [students, resolvedByTeam, resolvedByStudent]);
}

function KpiStrip({ kpis }: { kpis: KpiData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold">{kpis.totalActive}</div>
              <p className="text-sm text-muted-foreground">Currently At-Risk</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">{kpis.recoveredThisWeek}</div>
              <p className="text-sm text-muted-foreground">Recovered This Week</p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold">
                {kpis.avgDaysToRecover === null ? '—' : `${kpis.avgDaysToRecover}d`}
              </div>
              <p className="text-sm text-muted-foreground">Avg Days to Recover</p>
            </div>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold">
                {kpis.recoveryRatePct === null ? '—' : `${kpis.recoveryRatePct}%`}
              </div>
              <p className="text-sm text-muted-foreground">Recovery Rate</p>
            </div>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AtRiskStudents() {
  const { rules, configured, loading: rulesLoading, saveRules } = useAtRiskRules();
  const { students, resolvedByTeam, resolvedByStudent, loading: studentsLoading, refetch } = useAtRiskStudents(rules, configured);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [activeTab, setActiveTab] = useState('pending');

  // Mentor lookup for currently flagged students
  const studentUserIds = useMemo(() => students.map(s => s.user_id), [students]);
  const { mentorMap, allMentors, assignMentor } = useAtRiskMentors(studentUserIds);
  const { user } = useAuth();

  const handleAssignMentor = async (studentUserId: string, mentorId: string | null) => {
    if (!user?.id) return false;
    return assignMentor(studentUserId, mentorId, user.id);
  };

  const kpis = useKpis(students, resolvedByTeam, resolvedByStudent);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          At-Risk Students
        </h1>
        <p className="text-muted-foreground mt-1">
          Students flagged based on configurable detection rules. Records auto-clear when the student resolves the issue.
        </p>
      </div>

      <AtRiskRulesConfig rules={rules} configured={configured} onSave={saveRules} />

      {!configured && !rulesLoading && (
        <Card className="border-dashed border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Rules Configured</h3>
            <p className="text-muted-foreground text-sm">
              Set at least one rule above (value greater than 0) to start detecting at-risk students.
            </p>
          </CardContent>
        </Card>
      )}

      {configured && (
        <>
          <KpiStrip kpis={kpis} />

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">🔴 Critical</SelectItem>
                <SelectItem value="warning">🟡 Warning</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
              <SelectTrigger className="w-[200px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Longest at Risk First</SelectItem>
                <SelectItem value="oldest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Pending
                {students.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{students.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved-team" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Resolved by Team
                {resolvedByTeam.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{resolvedByTeam.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved-student" className="gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Resolved by Student
                {resolvedByStudent.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{resolvedByStudent.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <StudentTable
                students={students}
                search={search}
                loading={studentsLoading}
                emptyMessage="🎉 No at-risk students detected! All students are progressing well."
                showActions
                onRefetch={refetch}
                severityFilter={severityFilter}
                sortOrder={sortOrder}
                mentorMap={mentorMap}
                allMentors={allMentors}
                onAssignMentor={handleAssignMentor}
              />
            </TabsContent>

            <TabsContent value="resolved-team" className="mt-4">
              <StudentTable
                students={resolvedByTeam}
                search={search}
                loading={studentsLoading}
                emptyMessage="No students resolved by team intervention yet."
                onRefetch={refetch}
                severityFilter={severityFilter}
                sortOrder={sortOrder}
                mentorMap={mentorMap}
                allMentors={allMentors}
                onAssignMentor={handleAssignMentor}
              />
            </TabsContent>

            <TabsContent value="resolved-student" className="mt-4">
              <StudentTable
                students={resolvedByStudent}
                search={search}
                loading={studentsLoading}
                emptyMessage="No students self-resolved yet."
                onRefetch={refetch}
                severityFilter={severityFilter}
                sortOrder={sortOrder}
                mentorMap={mentorMap}
                allMentors={allMentors}
                onAssignMentor={handleAssignMentor}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
