import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { useActivePathwayAccess } from "@/hooks/useActivePathwayAccess";
import { useCourses } from "@/hooks/useCourses";
import { useCourseRecordings } from "@/hooks/useCourseRecordings";
import { usePathwayGroupedRecordings } from "@/hooks/usePathwayGroupedRecordings";
import { RoleGuard } from "@/components/RoleGuard";
import { InactiveLMSBanner } from "@/components/InactiveLMSBanner";
import { CourseSelector } from "@/components/courses/CourseSelector";
import { PathwayProgressCard } from "@/components/courses/PathwayProgressCard";
import { BatchPathwayView } from "@/components/videos/BatchPathwayView";
import { RecordingRow } from "@/components/videos/RecordingRow";
import { Play, BookOpen, ChevronDown, ChevronRight, Lock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Videos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Pathway-aware hook
  const {
    isInPathwayMode,
    pathwayState,
    pathwayCourses,
    loading: pathwayLoading,
    advancePathway,
    makeChoice,
    refreshPathwayState,
  } = useActivePathwayAccess();

  // Course-aware hooks
  const {
    enrolledCourses,
    activeCourse: defaultActiveCourse,
    setActiveCourse,
    loading: coursesLoading,
    isMultiCourseEnabled,
  } = useCourses();

  // In pathway mode, force active course to current pathway course
  const activeCourseId =
    isInPathwayMode && pathwayState
      ? pathwayState.currentCourseId
      : defaultActiveCourse?.id || null;

  const activeCourse =
    enrolledCourses.find((c) => c.id === activeCourseId) || defaultActiveCourse;

  const {
    modules,
    courseProgress,
    loading: recordingsLoading,
    refreshData,
  } = useCourseRecordings(activeCourseId);

  const { markRecordingWatched } = useProgressTracker(user);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [userLMSStatus, setUserLMSStatus] = useState<string>("active");
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Pathway-grouped recordings for pathway students
  const {
    courseGroups: pathwayCourseGroups,
    totalRecordings: pathwayTotalRecordings,
    totalWatched: pathwayTotalWatched,
    totalProgress: pathwayTotalProgress,
    loading: pathwayRecordingsLoading,
    refreshData: refreshPathwayRecordings,
  } = usePathwayGroupedRecordings(
    isInPathwayMode && pathwayState ? pathwayState.pathwayId : null
  );

  // Fetch user's LMS status
  React.useEffect(() => {
    const fetchUserLMSStatus = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("users")
        .select("lms_status")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setUserLMSStatus(data.lms_status || "active");
      }
    };
    fetchUserLMSStatus();
  }, [user?.id]);

  // Real-time refresh when submissions are approved/changed
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('videos-submission-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          refreshData();
          if (isInPathwayMode) refreshPathwayRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isInPathwayMode]);

  const handleWatchRecording = async (recording: any) => {
    if (userLMSStatus !== "active") return;
    if (!recording.isUnlocked || !recording.recording_url) return;
    await markRecordingWatched(recording.id);
    navigate(`/video-player?id=${recording.id}&title=${encodeURIComponent(recording.title || '')}`);
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) newSet.delete(moduleId);
      else newSet.add(moduleId);
      return newSet;
    });
  };

  const handleAdvancePathway = async () => {
    setIsAdvancing(true);
    try {
      const result = await advancePathway();
      if (result.success) {
        if (result.completed) {
          toast.success("Congratulations! You have completed the pathway!");
        } else if (result.awaitingChoice) {
          toast.info("Please select your learning path to continue", {
            description: "Choose between the available course tracks below",
          });
        } else {
          toast.success("Next course unlocked!");
        }
        refreshData();
      } else {
        toast.error(result.error || "Failed to advance pathway");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleMakeChoice = async (courseId: string) => {
    setIsAdvancing(true);
    try {
      const result = await makeChoice(courseId);
      if (result.success) {
        toast.success("Choice confirmed! Your selected course has been unlocked.");
        refreshData();
      } else {
        toast.error(result.error || "Failed to make choice");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const loading = coursesLoading || recordingsLoading || pathwayLoading || (isInPathwayMode && pathwayRecordingsLoading);

  const totalRecordings = modules.reduce((sum, module) => sum + module.recordings.length, 0);
  const watchedRecordings = modules.reduce((sum, module) => sum + module.watchedLessons, 0);

  // Find the next unwatched recording for "Continue where you left off"
  const nextUnwatchedRecording = useMemo(() => {
    for (const module of modules) {
      for (const rec of module.recordings) {
        if (rec.isUnlocked && !rec.isWatched) return { ...rec, moduleName: module.title, moduleId: module.id };
      }
    }
    return null;
  }, [modules]);

  // Auto-expand the module containing the next unwatched lesson
  useEffect(() => {
    if (!hasAutoExpanded && nextUnwatchedRecording && !searchQuery) {
      setExpandedModules(new Set([nextUnwatchedRecording.moduleId]));
      setHasAutoExpanded(true);
      // Scroll to the module after a short delay
      setTimeout(() => {
        const el = document.getElementById(`module-${nextUnwatchedRecording.moduleId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [hasAutoExpanded, nextUnwatchedRecording, searchQuery]);

  // Filter modules/recordings by search query
  const query = searchQuery.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (!query) return modules;
    return modules
      .map((module) => {
        const matchingRecordings = module.recordings.filter(
          (r: any) => r.title?.toLowerCase().includes(query)
        );
        const moduleMatches = module.title?.toLowerCase().includes(query);
        if (moduleMatches) return module;
        if (matchingRecordings.length > 0) return { ...module, recordings: matchingRecordings };
        return null;
      })
      .filter(Boolean) as typeof modules;
  }, [modules, query]);

  // Auto-expand modules when searching
  const effectiveExpanded = useMemo(() => {
    if (query) return new Set(filteredModules.map((m) => m.id));
    return expandedModules;
  }, [query, filteredModules, expandedModules]);

  const showCourseSelector = !isInPathwayMode && isMultiCourseEnabled && enrolledCourses.length > 1;
  const showCourseGroupedView = isInPathwayMode && pathwayCourseGroups.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["student", "admin", "mentor", "superadmin"]}>
      <div className="space-y-6 animate-fade-in">
        <InactiveLMSBanner show={user?.role === "student" && userLMSStatus === "inactive"} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">Available Lessons</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Watch lessons and complete assignments to track your progress
            </p>
          </div>

          {showCourseSelector && (
            <CourseSelector
              courses={enrolledCourses}
              activeCourseId={activeCourse?.id || null}
              onCourseChange={setActiveCourse}
              loading={coursesLoading}
            />
          )}
        </div>

        {/* Search bar */}
        {!showCourseGroupedView && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lessons or modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Continue where you left off banner */}
        {!showCourseGroupedView && nextUnwatchedRecording && userLMSStatus === 'active' && !query && (
          <Card className="sticky top-2 z-10 border-primary/30 bg-primary/5 shadow-md">
            <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Continue where you left off</p>
                  <p className="text-sm font-medium truncate">{nextUnwatchedRecording.recording_title}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleWatchRecording(nextUnwatchedRecording)} className="flex-shrink-0">
                <Play className="w-4 h-4 mr-1" />
                Watch
              </Button>
            </CardContent>
          </Card>
        )}
        {/* COURSE-GROUPED VIEW: Show Course > Module > Recording for pathway students */}
        {showCourseGroupedView ? (
          <>
            {/* Pathway Progress Card */}
            {isInPathwayMode && pathwayState && (
              <PathwayProgressCard
                pathwayState={pathwayState}
                pathwayCourses={pathwayCourses}
                onAdvance={handleAdvancePathway}
                onMakeChoice={handleMakeChoice}
                isAdvancing={isAdvancing}
              />
            )}

            <BatchPathwayView
              courseGroups={pathwayCourseGroups}
              totalRecordings={pathwayTotalRecordings}
              totalWatched={pathwayTotalWatched}
              totalProgress={pathwayTotalProgress}
              userLMSStatus={userLMSStatus}
              onWatch={handleWatchRecording}
            />
          </>
        ) : isInPathwayMode ? (
          /* Pathway mode but no grouped data — show empty state instead of fallback courses */
          <Card className="shadow-medium border-border/50">
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2 text-foreground">Pathway Content Loading</h3>
                <p>Your pathway courses are being configured. Please check back later or contact your instructor.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Course progress card - show when NOT in pathway mode */}
            {activeCourse && totalRecordings > 0 && (
              <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="font-medium">{activeCourse.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {watchedRecordings} / {totalRecordings} lessons completed
                    </span>
                  </div>
                  <Progress value={courseProgress} className="h-2" />
                </CardContent>
              </Card>
            )}

            {filteredModules.length === 0 ? (
              <Card className="shadow-medium border-border/50">
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    {query ? (
                      <>
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2 text-foreground">No Results Found</h3>
                        <p>No lessons match "{searchQuery}". Try a different search term.</p>
                      </>
                    ) : (
                      <>
                        <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2 text-foreground">No Video Lessons Available</h3>
                        <p>Check back later for new lessons or contact your instructor.</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredModules.map((module) => (
                  <Card key={module.id} id={`module-${module.id}`} className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
                    <Collapsible open={effectiveExpanded.has(module.id)} onOpenChange={() => toggleModule(module.id)}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-xl font-semibold flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                  {module.order}
                                </div>
                                {module.title}
                                {module.isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {module.totalLessons} recordings • {module.watchedLessons} completed
                              </p>
                            </div>
                            {expandedModules.has(module.id) ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <CardContent className="p-0">
                          <div className="space-y-2 p-4">
                            {module.recordings.map((recording, index) => (
                              <RecordingRow
                                key={recording.id}
                                recording={recording}
                                index={index}
                                userLMSStatus={userLMSStatus}
                                onWatch={handleWatchRecording}
                              />
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
};

export default Videos;
