import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lock, Unlock, Calendar, BookOpen, ChevronRight, Route } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  is_active: boolean;
  price: number | null;
  access_duration_days: number | null;
}

interface Pathway {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  is_active: boolean;
  price: number | null;
  access_duration_days: number | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  pathway_id: string | null;
  status: string;
  enrolled_at: string | null;
  access_expires_at: string | null;
  enrollment_source: string | null;
}

const Catalog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch student record to get student_id
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentError) throw studentError;
      
      const currentStudentId = studentData?.id || null;
      setStudentId(currentStudentId);

      // Fetch all active courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, description, thumbnail_url, is_published, is_active, price, access_duration_days')
        .eq('is_active', true)
        .order('sequence_order', { ascending: true });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch all active pathways
      const { data: pathwaysData, error: pathwaysError } = await supabase
        .from('learning_pathways')
        .select('id, name, description, thumbnail_url, is_published, is_active, price, access_duration_days')
        .eq('is_active', true);

      if (pathwaysError) throw pathwaysError;
      setPathways(pathwaysData || []);

      // Fetch user's enrollments if they have a student record
      // Include enrollment_source to distinguish direct vs pathway enrollments
      if (currentStudentId) {
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('course_enrollments')
          .select('id, course_id, pathway_id, status, enrolled_at, access_expires_at, enrollment_source')
          .eq('student_id', currentStudentId)
          .eq('status', 'active');

        if (enrollmentsError) throw enrollmentsError;
        setEnrollments(enrollmentsData || []);
      }
    } catch (error) {
      console.error('Error fetching catalog data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get direct course enrollment (NOT pathway-based)
  const getDirectEnrollment = (courseId: string) => {
    return enrollments.find(e => 
      e.course_id === courseId && 
      (e.enrollment_source === 'direct' || e.pathway_id === null)
    );
  };

  const getPathwayEnrollment = (pathwayId: string) => {
    return enrollments.find(e => e.pathway_id === pathwayId);
  };

  // Individual course is unlocked only if directly enrolled (not via pathway)
  const isUnlocked = (courseId: string) => {
    const enrollment = getDirectEnrollment(courseId);
    if (!enrollment) return false;
    
    // Check if access has expired
    if (enrollment.access_expires_at) {
      const expiryDate = new Date(enrollment.access_expires_at);
      if (expiryDate < new Date()) return false;
    }
    
    return enrollment.status === 'active';
  };

  const isPathwayUnlocked = (pathwayId: string) => {
    const enrollment = getPathwayEnrollment(pathwayId);
    if (!enrollment) return false;
    
    if (enrollment.access_expires_at) {
      const expiryDate = new Date(enrollment.access_expires_at);
      if (expiryDate < new Date()) return false;
    }
    
    return enrollment.status === 'active';
  };

  const getAccessExpiry = (courseId: string) => {
    const enrollment = getDirectEnrollment(courseId);
    if (!enrollment?.access_expires_at) return null;
    return new Date(enrollment.access_expires_at);
  };

  const getPathwayAccessExpiry = (pathwayId: string) => {
    const enrollment = getPathwayEnrollment(pathwayId);
    if (!enrollment?.access_expires_at) return null;
    return new Date(enrollment.access_expires_at);
  };

  const handleCourseClick = (course: Course) => {
    if (isUnlocked(course.id)) {
      navigate('/videos');
    }
  };

  const handlePathwayClick = (pathway: Pathway) => {
    if (isPathwayUnlocked(pathway.id)) {
      navigate('/videos');
    }
  };

  const unlockedCourses = courses.filter(c => isUnlocked(c.id));
  const lockedCourses = courses.filter(c => !isUnlocked(c.id));
  const unlockedPathways = pathways.filter(p => isPathwayUnlocked(p.id));
  const lockedPathways = pathways.filter(p => !isPathwayUnlocked(p.id));

  if (loading) {
    return (
      <div className="min-h-screen overflow-y-auto">
        <div className="space-y-8 p-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Course Catalog</h1>
            <p className="text-muted-foreground mt-1">Browse all available courses</p>
          </div>
          
          {/* Pathways skeleton */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Learning Pathways</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Courses skeleton */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Individual Courses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalUnlocked = unlockedCourses.length + unlockedPathways.length;
  const totalLocked = lockedCourses.length + lockedPathways.length;

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="space-y-8 p-6 pb-12 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Course Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Browse all available content • {totalUnlocked} unlocked, {totalLocked} locked
          </p>
        </div>

        {/* Pathways Section */}
        {pathways.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              Learning Pathways
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...unlockedPathways, ...lockedPathways].map((pathway) => {
                const unlocked = isPathwayUnlocked(pathway.id);
                const expiryDate = getPathwayAccessExpiry(pathway.id);
                const isExpiringSoon = expiryDate && 
                  (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7;

                return (
                  <Card 
                    key={pathway.id} 
                    className={`overflow-hidden transition-all duration-300 ${
                      unlocked 
                        ? 'hover:shadow-lg cursor-pointer border-primary/20' 
                        : 'opacity-75 cursor-not-allowed'
                    }`}
                    onClick={() => handlePathwayClick(pathway)}
                  >
                    <div className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/10 overflow-hidden">
                      {pathway.thumbnail_url ? (
                        <img 
                          src={pathway.thumbnail_url} 
                          alt={pathway.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Route className="w-16 h-16 text-primary/40" />
                        </div>
                      )}
                      
                      <div className={`absolute top-3 right-3 p-2 rounded-full ${
                        unlocked 
                          ? 'bg-green-500 text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {unlocked ? (
                          <Unlock className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </div>

                      {!pathway.is_published && (
                        <Badge 
                          variant="secondary" 
                          className="absolute top-3 left-3 bg-yellow-500/90 text-yellow-950"
                        >
                          Draft
                        </Badge>
                      )}

                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-3 left-3 bg-primary/90 text-primary-foreground"
                      >
                        Pathway
                      </Badge>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {pathway.name}
                        </h3>
                        {pathway.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {pathway.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        {unlocked ? (
                          <div className="flex flex-col">
                            <div className="flex items-center text-green-600 text-sm font-medium">
                              <Unlock className="w-3.5 h-3.5 mr-1.5" />
                              Unlocked
                            </div>
                            {expiryDate && (
                              <div className={`flex items-center text-xs mt-1 ${
                                isExpiringSoon ? 'text-orange-600' : 'text-muted-foreground'
                              }`}>
                                <Calendar className="w-3 h-3 mr-1" />
                                Access until {format(expiryDate, 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center text-muted-foreground text-sm">
                            <Lock className="w-3.5 h-3.5 mr-1.5" />
                            Locked
                          </div>
                        )}
                        
                        {unlocked && (
                          <Button variant="ghost" size="sm" className="text-primary">
                            Start <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Courses Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Individual Courses
          </h2>
          <p className="text-sm text-muted-foreground -mt-2">
            Courses you have direct access to (not via a learning pathway)
          </p>
          
          {courses.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Courses Available</h3>
              <p className="text-muted-foreground">
                There are no courses available at the moment. Please check back later.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...unlockedCourses, ...lockedCourses].map((course) => {
                const unlocked = isUnlocked(course.id);
                const expiryDate = getAccessExpiry(course.id);
                const isExpiringSoon = expiryDate && 
                  (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7;

                return (
                  <Card 
                    key={course.id} 
                    className={`overflow-hidden transition-all duration-300 ${
                      unlocked 
                        ? 'hover:shadow-lg cursor-pointer border-primary/20' 
                        : 'opacity-75 cursor-not-allowed'
                    }`}
                    onClick={() => handleCourseClick(course)}
                  >
                    <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img 
                          src={course.thumbnail_url} 
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-16 h-16 text-primary/30" />
                        </div>
                      )}
                      
                      <div className={`absolute top-3 right-3 p-2 rounded-full ${
                        unlocked 
                          ? 'bg-green-500 text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {unlocked ? (
                          <Unlock className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </div>

                      {!course.is_published && (
                        <Badge 
                          variant="secondary" 
                          className="absolute top-3 left-3 bg-yellow-500/90 text-yellow-950"
                        >
                          Draft
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {course.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        {unlocked ? (
                          <div className="flex flex-col">
                            <div className="flex items-center text-green-600 text-sm font-medium">
                              <Unlock className="w-3.5 h-3.5 mr-1.5" />
                              Unlocked
                            </div>
                            {expiryDate && (
                              <div className={`flex items-center text-xs mt-1 ${
                                isExpiringSoon ? 'text-orange-600' : 'text-muted-foreground'
                              }`}>
                                <Calendar className="w-3 h-3 mr-1" />
                                Access until {format(expiryDate, 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center text-muted-foreground text-sm">
                            <Lock className="w-3.5 h-3.5 mr-1.5" />
                            Locked
                          </div>
                        )}
                        
                        {unlocked && (
                          <Button variant="ghost" size="sm" className="text-primary">
                            Start <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
