import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, BookOpen, GraduationCap, Search, CalendarIcon, X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface EnrolledStudent {
  student_id: string;
  student_name: string;
  student_batch: string | null;
  joining_date: string;
  lms_status: string;
  enrollment_type: 'direct' | 'affiliate';
  pathway_name?: string;
}

interface CourseWithStudents {
  course_id: string;
  course_title: string;
  students: EnrolledStudent[];
}

const PAGE_SIZE = 25;

export const MentorStudents = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [coursesWithStudents, setCoursesWithStudents] = useState<CourseWithStudents[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedLmsStatus, setSelectedLmsStatus] = useState<string>('all');
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [allBatches, setAllBatches] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      fetchMentorStudents();
      fetchAllBatches();
    }
  }, [user]);

  const fetchAllBatches = async () => {
    const { data } = await supabase
      .from('batches')
      .select('id, name')
      .order('name');
    setAllBatches(data || []);
  };

  const fetchMentorStudents = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch ALL student records (primary source - matches admin count)
      const { data: allStudentRecords } = await supabase
        .from('students')
        .select('id, student_id, user_id, enrollment_date, fees_cleared');

      // 2. Fetch user details via edge function to bypass RLS restrictions
      const studentUserIds = [...new Set(allStudentRecords?.map(sr => sr.user_id).filter(Boolean) || [])];
      const userMap = new Map<string, { id: string; full_name: string | null; lms_status: string | null; created_at: string | null; created_by: string | null }>();
      
      if (studentUserIds.length > 0) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('get-user-details', {
          body: { user_ids: studentUserIds }
        });
        if (fnError) {
          console.error('get-user-details edge function error:', fnError);
        } else if (fnData?.error) {
          console.error('get-user-details returned error:', fnData.error);
        } else if (fnData?.users) {
          fnData.users.forEach((u: any) => {
            userMap.set(u.id, { id: u.id, full_name: u.full_name, lms_status: u.lms_status, created_at: u.created_at, created_by: u.created_by || null });
          });
        }
      }

      // 3. Fetch all course enrollments WITHOUT students!inner join
      const { data: allEnrollments } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          student_id,
          course_id,
          pathway_id,
          enrolled_at,
          status,
          batch_id,
          batches(id, name),
          courses(id, title),
          learning_pathways(id, name)
        `);

      // 4. Get mentor's assigned courses
      const { data: mentorCourses } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, is_global, courses(id, title)')
        .eq('mentor_id', user.id);

      const isGlobalMentor = mentorCourses?.some(mc => mc.is_global);
      const courseIds = mentorCourses?.map(mc => mc.course_id).filter(Boolean) || [];

      // Build lookup maps
      const studentRecordByIdMap = new Map<string, { user_id: string; student_id: string; fees_cleared: boolean | null }>();
      allStudentRecords?.forEach(sr => {
        studentRecordByIdMap.set(sr.id, { user_id: sr.user_id, student_id: sr.student_id || sr.id, fees_cleared: sr.fees_cleared });
      });

      // Link enrollments to users via student records
      const enrollmentsByUserId = new Map<string, typeof allEnrollments>();
      allEnrollments?.forEach(enrollment => {
        const studentRecord = studentRecordByIdMap.get(enrollment.student_id);
        if (studentRecord) {
          const userId = studentRecord.user_id;
          if (!enrollmentsByUserId.has(userId)) {
            enrollmentsByUserId.set(userId, []);
          }
          enrollmentsByUserId.get(userId)!.push(enrollment);
        }
      });

      // Group students by course
      const courseMap = new Map<string, CourseWithStudents>();
      const uniqueStudentIds = new Set<string>();

      // Process each student record (from students table - matches admin count)
      allStudentRecords?.forEach(studentRecord => {
        const userId = studentRecord.user_id;
        const userInfo = userMap.get(userId);
        const userEnrollments = enrollmentsByUserId.get(userId) || [];
        const displayStudentId = studentRecord.student_id || studentRecord.id;
        const displayName = userInfo?.full_name || 'Unknown';
        const userLmsStatus = userInfo?.lms_status || 'inactive';

        if (userEnrollments.length === 0) {
          // Student has no enrollments - add to Unassigned
          const unassignedCourseId = '__all_students__';
          if (!courseMap.has(unassignedCourseId)) {
            courseMap.set(unassignedCourseId, {
              course_id: unassignedCourseId,
              course_title: 'Unassigned',
              students: []
            });
          }

          const studentKey = `${userId}-${unassignedCourseId}`;
          if (!uniqueStudentIds.has(studentKey)) {
            uniqueStudentIds.add(studentKey);
            courseMap.get(unassignedCourseId)!.students.push({
              student_id: displayStudentId,
              student_name: displayName,
              student_batch: null,
              joining_date: studentRecord.enrollment_date || userInfo?.created_at || '',
              lms_status: userLmsStatus,
              enrollment_type: 'direct'
            });
          }
        } else {
          // Student has enrollments - add to each course
          userEnrollments.forEach(enrollment => {
            const courseId = enrollment.course_id;
            const courseTitle = enrollment.courses?.title || 'Unknown Course';
            const batchName = enrollment.batches?.name || null;
            // Only mark as affiliate if the logged-in mentor created this student
            const isAffiliate = userInfo?.created_by === user.id;

            if (!courseMap.has(courseId)) {
              courseMap.set(courseId, {
                course_id: courseId,
                course_title: courseTitle,
                students: []
              });
            }

            const studentKey = `${userId}-${courseId}`;
            if (!uniqueStudentIds.has(studentKey)) {
              uniqueStudentIds.add(studentKey);
              courseMap.get(courseId)!.students.push({
                student_id: displayStudentId,
                student_name: displayName,
                student_batch: batchName,
                joining_date: enrollment.enrolled_at || studentRecord.enrollment_date || '',
                lms_status: userLmsStatus,
                enrollment_type: isAffiliate ? 'affiliate' : 'direct',
                pathway_name: enrollment.learning_pathways?.name
              });
            }
          });
        }
      });

      const coursesArray = Array.from(courseMap.values()).sort((a, b) => 
        a.course_title.localeCompare(b.course_title)
      );

      // Count unique students across all courses
      const allUniqueStudents = new Set<string>();
      coursesArray.forEach(course => {
        course.students.forEach(s => allUniqueStudents.add(s.student_id));
      });

      setCoursesWithStudents(coursesArray);
      setTotalStudents(allUniqueStudents.size);
    } catch (error) {
      console.error('Error fetching mentor students:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLmsStatus = (enrollmentStatus: string | null, feesCleared: boolean | null): string => {
    if (enrollmentStatus === 'completed' || enrollmentStatus === 'complete') return 'completed';
    if (enrollmentStatus === 'suspended') return 'suspended';
    if (enrollmentStatus === 'dropout') return 'dropout';
    if (enrollmentStatus === 'inactive' || feesCleared === false) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'inactive':
        return <Badge variant="destructive">Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Suspended</Badge>;
      case 'dropout':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Dropout</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Use all batches from DB for the filter
  const availableBatches = useMemo(() => {
    return allBatches.map(b => b.name);
  }, [allBatches]);

  // Filter courses based on selection
  const filteredCourses = useMemo(() => {
    if (selectedCourseId === 'all') {
      return coursesWithStudents;
    }
    return coursesWithStudents.filter(c => c.course_id === selectedCourseId);
  }, [coursesWithStudents, selectedCourseId]);

  // Apply all filters to get filtered students per course
  const filteredCoursesWithStudents = useMemo(() => {
    return filteredCourses.map(course => {
      let students = [...course.students];

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        students = students.filter(s => 
          s.student_name.toLowerCase().includes(query) ||
          s.student_id.toLowerCase().includes(query)
        );
      }

      // Batch filter (multi-select)
      if (selectedBatches.length > 0) {
        students = students.filter(s => 
          s.student_batch ? selectedBatches.includes(s.student_batch) : false
        );
      }

      // Date range filter
      if (dateRange?.from) {
        students = students.filter(s => {
          if (!s.joining_date) return false;
          const joinDate = parseISO(s.joining_date);
          if (dateRange.to) {
            return isWithinInterval(joinDate, { start: dateRange.from!, end: dateRange.to });
          }
          return joinDate >= dateRange.from!;
        });
      }

      // LMS status filter
      if (selectedLmsStatus !== 'all') {
        students = students.filter(s => s.lms_status === selectedLmsStatus);
      }

      // Enrollment type filter
      if (selectedEnrollmentType !== 'all') {
        students = students.filter(s => s.enrollment_type === selectedEnrollmentType);
      }

      return { ...course, students };
    }).filter(course => course.students.length > 0);
  }, [filteredCourses, searchQuery, selectedBatches, dateRange, selectedLmsStatus, selectedEnrollmentType]);

  // Calculate stats based on filtered courses
  const filteredTotalStudents = useMemo(() => {
    const uniqueStudentIds = new Set<string>();
    filteredCoursesWithStudents.forEach(course => {
      course.students.forEach(s => uniqueStudentIds.add(s.student_id));
    });
    return uniqueStudentIds.size;
  }, [filteredCoursesWithStudents]);

  const filteredActiveStudents = useMemo(() => {
    return filteredCoursesWithStudents.reduce((acc, course) => 
      acc + course.students.filter(s => s.lms_status === 'active').length, 0
    );
  }, [filteredCoursesWithStudents]);

  const handleBatchToggle = (batch: string) => {
    setSelectedBatches(prev => 
      prev.includes(batch) 
        ? prev.filter(b => b !== batch)
        : [...prev, batch]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCourseId('all');
    setSelectedBatches([]);
    setDateRange(undefined);
    setSelectedLmsStatus('all');
    setSelectedEnrollmentType('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCourseId, selectedBatches, dateRange, selectedLmsStatus, selectedEnrollmentType]);

  const hasActiveFilters = searchQuery || selectedCourseId !== 'all' || selectedBatches.length > 0 || 
    dateRange?.from || selectedLmsStatus !== 'all' || selectedEnrollmentType !== 'all' || sortOrder !== 'newest';

  // Flatten all students for single table display and sort by joining date
  const allFilteredStudents = useMemo(() => {
    const students = filteredCoursesWithStudents.flatMap(course => 
      course.students.map(student => ({
        ...student,
        course_title: course.course_title
      }))
    );
    
    // Sort by joining date
    return students.sort((a, b) => {
      const dateA = a.joining_date ? new Date(a.joining_date).getTime() : 0;
      const dateB = b.joining_date ? new Date(b.joining_date).getTime() : 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [filteredCoursesWithStudents, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(allFilteredStudents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudents = allFilteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getMentorPaginationRange = () => {
    const range: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (safePage > 3) range.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) range.push(i);
      if (safePage < totalPages - 2) range.push('...');
      range.push(totalPages);
    }
    return range;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTotalStudents}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? 'Matching filters' : 'Across all your courses'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses Assigned</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coursesWithStudents.length}</div>
            <p className="text-xs text-muted-foreground">You are mentoring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredActiveStudents}</div>
            <p className="text-xs text-muted-foreground">Currently learning</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Details Card with Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Student Details</CardTitle>
          <CardDescription>
            {allFilteredStudents.length} student{allFilteredStudents.length !== 1 ? 's' : ''} {hasActiveFilters ? 'matching filters' : 'enrolled'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Icon */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Filter Sheet Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {/* Course Filter */}
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Courses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Courses</SelectItem>
                        {coursesWithStudents.map((course) => (
                          <SelectItem key={course.course_id} value={course.course_id}>
                            {course.course_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Batch Multi-Select */}
                  <div className="space-y-2">
                    <Label>Batches</Label>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-2">
                      {availableBatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">No batches available</p>
                      ) : (
                        availableBatches.map((batch) => (
                          <div key={batch} className="flex items-center space-x-2">
                            <Checkbox
                              id={`sheet-batch-${batch}`}
                              checked={selectedBatches.includes(batch)}
                              onCheckedChange={() => handleBatchToggle(batch)}
                            />
                            <label
                              htmlFor={`sheet-batch-${batch}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {batch}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedBatches.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setSelectedBatches([])}
                      >
                        Clear Batches
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Date Range Picker */}
                  <div className="space-y-2">
                    <Label>Joining Date Range</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <span className="text-sm">
                                {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span className="text-sm">{format(dateRange.from, "MMM d, yyyy")}</span>
                            )
                          ) : (
                            <span className="text-sm">Select date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={1}
                        />
                        {dateRange?.from && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => setDateRange(undefined)}
                            >
                              Clear
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Separator />

                  {/* LMS Status */}
                  <div className="space-y-2">
                    <Label>LMS Status</Label>
                    <Select value={selectedLmsStatus} onValueChange={setSelectedLmsStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="dropout">Dropout</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Enrollment Type */}
                  <div className="space-y-2">
                    <Label>Enrollment Type</Label>
                    <Select value={selectedEnrollmentType} onValueChange={setSelectedEnrollmentType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="affiliate">Affiliate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Sort Order */}
                  <div className="space-y-2">
                    <Label>Sort by Joining Date</Label>
                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'newest' | 'oldest')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <>
                      <Separator />
                      <Button variant="outline" onClick={clearAllFilters} className="w-full">
                        <X className="h-4 w-4 mr-2" />
                        Clear All Filters
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {(() => {
                  let count = 0;
                  if (selectedCourseId !== 'all') count++;
                  if (selectedBatches.length > 0) count++;
                  if (dateRange?.from) count++;
                  if (selectedLmsStatus !== 'all') count++;
                  if (selectedEnrollmentType !== 'all') count++;
                  if (sortOrder !== 'newest') count++;
                  return `${count} filter${count > 1 ? 's' : ''} applied`;
                })()}
              </Badge>
            )}
          </div>

          {/* Student Table */}
          {coursesWithStudents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No courses assigned yet. Contact an administrator to get course assignments.</p>
            </div>
          ) : allFilteredStudents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students match your filters.</p>
              <Button variant="link" onClick={clearAllFilters}>Clear all filters</Button>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>LMS Status</TableHead>
                  <TableHead>Enrollment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((student, idx) => (
                  <TableRow key={`${student.student_id}-${idx}`}>
                    <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.student_name}</TableCell>
                    <TableCell>
                      {student.student_batch ? (
                        <Badge variant="outline">{student.student_batch}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No Batch</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.joining_date 
                        ? format(new Date(student.joining_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(student.lms_status)}</TableCell>
                    <TableCell>
                      {student.enrollment_type === 'affiliate' ? (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          Your Affiliate
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Direct</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, allFilteredStudents.length)} of {allFilteredStudents.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getMentorPaginationRange().map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                    ) : (
                      <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(p as number)}>
                        {p}
                      </Button>
                    )
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
