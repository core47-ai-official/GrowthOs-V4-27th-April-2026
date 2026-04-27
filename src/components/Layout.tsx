// Version: 2025-10-18-fix-alerttriangle-cache
import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import SuccessPartner from "@/components/SuccessPartner";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, BookOpen, FileText, MessageSquare, Bell, Video, ChevronDown, ChevronRight, LogOut, Users, UserCheck, User, Calendar, Menu, X, Activity, Building2, ShoppingBag, Target, MessageCircle, Trophy, BarChart3, AlertTriangle, Facebook, GraduationCap, Route, LayoutGrid, Lock, Layers, Sun, Moon } from "lucide-react";
const MetaIcon = Facebook;
import { useTheme } from "next-themes";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ActivityLogsDialog } from "./ActivityLogsDialog";
import { MotivationalNotifications } from "./MotivationalNotifications";
import { AppLogo } from "./AppLogo";
import { ScrollToTop } from "./ScrollToTop";
import { PageSkeleton } from "./LoadingStates/PageSkeleton";
import RouteContentLoader from "./LoadingStates/RouteContentLoader";
import { throttle } from "@/utils/performance";
import { safeLogger } from '@/lib/safe-logger';
import { AnnouncementBanner } from "./AnnouncementBanner";
import { LiveChatWidget } from "./LiveChatWidget";

import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { User as UserType } from '@/types/common';

interface LayoutProps {
  user: UserType;
}

interface CourseMenuItem {
  id: string;
  title: string;
  isEnrolled: boolean;
}

// Memoized navigation items to prevent unnecessary re-computations
const NavigationItems = memo(({
  isUserSuperadmin,
  isUserAdmin,
  isUserMentor,
  isUserEnrollmentManager,
  connectionStatus,
  courseMenuOpen,
  setCourseMenuOpen,
  location,
  sidebarCollapsed
}: any) => {
  const navigationItems = useMemo(() => {
    const items = [{
      to: "/",
      icon: Monitor,
      label: "Dashboard",
      roles: ['student', 'admin', 'superadmin', 'mentor', 'enrollment_manager']
    }, {
      to: "/videos",
      icon: Video,
      label: "Modules & Videos",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/assignments",
      icon: FileText,
      label: "Assignments",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/live-sessions",
      icon: Calendar,
      label: "Live Sessions",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }, {
      to: "/teams",
      icon: Users,
      label: "Teams",
      roles: ['admin', 'superadmin']
    }, {
      to: "/support",
      icon: MessageSquare,
      label: "Support",
      roles: ['student', 'admin', 'superadmin', 'mentor']
    }];

    // Add conditional items based on user role
    if (isUserSuperadmin) {
      items.push({
        to: "/superadmin",
        icon: Building2,
        label: "Super Admin",
        roles: ['superadmin']
      });
    }
    if (isUserAdmin || isUserSuperadmin) {
      items.push({
        to: "/admin",
        icon: UserCheck,
        label: "Admin Panel",
        roles: ['admin', 'superadmin']
      });
    }
    if (isUserMentor) {
      items.push({
        to: "/mentor",
        icon: User,
        label: "Mentor Dashboard",
        roles: ['mentor']
      });
    }
    if (isUserEnrollmentManager) {
      items.push({
        to: "/enrollment-manager",
        icon: UserCheck,
        label: "Enrollment Manager",
        roles: ['enrollment_manager']
      });
    }
    return items;
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager]);
  return <nav className="space-y-2 px-4">
      {navigationItems.map(item => <Link key={item.to} to={item.to} className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${location.pathname === item.to ? 'bg-primary text-primary-foreground shadow-sm' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
            ${sidebarCollapsed ? 'justify-center' : ''}
          `}>
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
        </Link>)}
      
      {/* Course navigation */}
      {!sidebarCollapsed && <div className="pt-4">
          <button onClick={() => setCourseMenuOpen(!courseMenuOpen)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full">
            <BookOpen className="h-4 w-4" />
            <span>Course</span>
            {courseMenuOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
          </button>
          
          {courseMenuOpen && <div className="ml-6 mt-2 space-y-2">
              <Link to="/certificates" className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/certificates' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}>
                Certificates
              </Link>
              <Link to="/leaderboard" className={`
                  flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors
                  ${location.pathname === '/leaderboard' ? 'bg-primary text-primary-foreground' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}>
                Leaderboard
              </Link>
            </div>}
        </div>}
      
      {/* Connection status indicators */}
      {!sidebarCollapsed && (connectionStatus.shopify || connectionStatus.meta) && <div className="pt-4 border-t border-gray-200">
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Integrations
            </h3>
            <div className="space-y-2">
              {connectionStatus.shopify && <Link to="/shopify-dashboard" className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/shopify-dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                  `}>
                  <ShoppingBag className="h-4 w-4" />
                  <span>Shopify</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>}
              {connectionStatus.meta && <Link to="/meta-ads-dashboard" className={`
                    flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
                    ${location.pathname === '/meta-ads-dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                  `}>
                  <MetaIcon className="h-5 w-5" />
                  <span>Meta Ads</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Connected
                  </Badge>
                </Link>}
            </div>
          </div>
        </div>}
    </nav>;
});
NavigationItems.displayName = "NavigationItems";

// Dark mode toggle component
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-muted-foreground hover:text-primary hover:border-primary/30 p-2"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
};

const Layout = memo(({
  user
}: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    toast
  } = useToast();
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showSuccessPartner, setShowSuccessPartner] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    shopify: false,
    meta: false
  });
  const [catalogCourses, setCatalogCourses] = useState<CourseMenuItem[]>([]);
  
  // Track announcement banner visibility via callback from the component
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const isUserSuperadmin = user?.role === 'superadmin';
  const isUserAdmin = user?.role === 'admin';
  const isUserMentor = user?.role === 'mentor';
  const isUserEnrollmentManager = user?.role === 'enrollment_manager';
  const isUserSupportMember = user?.role === 'support_member';
  const isUserAdminOrSuperadmin = isUserSuperadmin || isUserAdmin;
  
  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Fetch courses for catalog menu (students only)
  useEffect(() => {
    const fetchCatalogCourses = async () => {
      if (!user?.id || user?.role !== 'student') return;
      
      try {
        // First, look up the student record to get the correct students.id
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const studentId = studentData?.id;
        if (!studentId) {
          setCatalogCourses([]);
          return;
        }

        // Fetch all active courses
        const { data: courses } = await supabase
          .from('courses')
          .select('id, title')
          .eq('is_active', true)
          .order('sequence_order', { ascending: true });

        // Fetch direct enrollments (courses enrolled directly, not via pathway)
        const { data: directEnrollments } = await supabase
          .from('course_enrollments')
          .select('course_id, status, pathway_id')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .is('pathway_id', null);

        const directEnrolledCourseIds = new Set(directEnrollments?.map(e => e.course_id) || []);

        // Fetch student's active pathway
        const { data: activePathwayData } = await supabase
          .rpc('get_student_active_pathway', { p_user_id: user.id });

        // Build a set of accessible course IDs from pathway
        const pathwayAccessibleCourseIds = new Set<string>();
        
        // activePathwayData is an array, get first element
        const activePathway = activePathwayData?.[0];
        
        if (activePathway?.pathway_id) {
          // Fetch pathway course map to determine which pathway courses are accessible
          const { data: pathwayCourseMap } = await supabase.rpc('get_student_pathway_course_map', {
            p_user_id: user.id,
            p_pathway_id: activePathway.pathway_id
          });

          if (pathwayCourseMap && Array.isArray(pathwayCourseMap)) {
            for (const course of pathwayCourseMap) {
              // Course is accessible if it's available (unlocked in pathway sequence)
              if (course.is_available) {
                pathwayAccessibleCourseIds.add(course.course_id);
              }
            }
          }
        }

        const courseItems: CourseMenuItem[] = (courses || []).map(course => ({
          id: course.id,
          title: course.title,
          // Course is enrolled if directly enrolled OR accessible via pathway
          isEnrolled: directEnrolledCourseIds.has(course.id) || pathwayAccessibleCourseIds.has(course.id)
        }));

        setCatalogCourses(courseItems);
      } catch (error) {
        console.error('Error fetching catalog courses:', error);
      }
    };

    fetchCatalogCourses();
  }, [user?.id, user?.role]);

  const toggleCourseExpand = useCallback((courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  }, []);

  // Check connection status on mount and when user changes
  useEffect(() => {
    let isMounted = true;
    const checkConnections = async () => {
      if (!user?.id) return;
      try {
        // First try to get connections from integrations table
        const {
          data,
          error
        } = await supabase.from('integrations').select('source, access_token').eq('user_id', user.id);
        if (!error && data && data.length > 0) {
          if (!isMounted) return;
          const hasShopify = !!data.some((r: any) => r.source === 'shopify' && r.access_token);
          const hasMeta = !!data.some((r: any) => r.source === 'meta_ads' && r.access_token);
          safeLogger.debug('Connection check - integrations data', {
            data,
            hasShopify,
            hasMeta
          });
          setConnectionStatus({
            shopify: hasShopify,
            meta: hasMeta
          });
          return;
        }

        // Fallback: Check users table for credential fields
        const {
          data: userData,
          error: userError
        } = await supabase.from('users').select('shopify_credentials, meta_ads_credentials').eq('id', user.id).single();
        if (!userError && userData) {
          if (!isMounted) return;
          const hasShopify = !!userData.shopify_credentials;
          const hasMeta = !!userData.meta_ads_credentials;
          safeLogger.debug('Connection check - user credentials', {
            userData,
            hasShopify,
            hasMeta
          });
          setConnectionStatus({
            shopify: hasShopify,
            meta: hasMeta
          });
        } else {
          safeLogger.debug('No connections found in either table');
          setConnectionStatus({
            shopify: false,
            meta: false
          });
        }
      } catch (e) {
        console.error('Error checking connections:', e);
        setConnectionStatus({
          shopify: false,
          meta: false
        });
      }
    };
    if (user?.id) {
      checkConnections();
      (window as any).checkIntegrations = checkConnections;
    }
    return () => {
      isMounted = false;
      if ((window as any).checkIntegrations) delete (window as any).checkIntegrations;
    };
  }, [user?.id]);

  // Prefetch route chunks on idle to reduce perceived load during navigation
  useEffect(() => {
    const idle = (cb: () => void) => "requestIdleCallback" in window ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 1200);
    const idleId: any = idle(() => {
      Promise.allSettled([import("@/pages/Profile"), import("@/pages/Teams"), import("@/pages/Support"), import("@/pages/Connect"), import("@/pages/MentorSessionsPage"), import("@/pages/ShopifyDashboard"), import("@/pages/MetaAdsDashboard")]);
    });
    return () => {
      if (typeof idleId === "number") {
        clearTimeout(idleId);
      } else if ("cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleId);
      }
    };
  }, []);

  // Hover prefetch for sidebar links
  const prefetchByHref = useCallback((href: string) => {
    try {
      if (href.startsWith("/profile")) import("@/pages/Profile");else if (href.startsWith("/teams")) import("@/pages/Teams");else if (href.startsWith("/support")) import("@/pages/Support");else if (href.startsWith("/connect")) import("@/pages/Connect");else if (href.startsWith("/mentor/sessions")) import("@/pages/MentorSessionsPage");else if (href.startsWith("/shopify-dashboard")) import("@/pages/ShopifyDashboard");else if (href.startsWith("/meta-ads-dashboard")) import("@/pages/MetaAdsDashboard");else if (href.startsWith("/admin")) import("@/pages/AdminDashboard");else if (href.startsWith("/superadmin")) import("@/pages/SuperadminDashboard");else if (href.startsWith("/enrollment-manager")) import("@/pages/EnrollmentManagerDashboard");
    } catch (e) {
      // noop
    }
  }, []);

  // Check if any course submenu is active to keep it expanded
  const isCourseMenuActive = location.search.includes('tab=modules') || location.search.includes('tab=recordings') || location.search.includes('tab=assignments') || location.search.includes('tab=submissions') || location.search.includes('tab=success-sessions') || location.search.includes('tab=milestones');

  // Memoize navigation to prevent unnecessary re-renders
  const navigation = useMemo(() => {
    if (isUserSuperadmin) {
      return [{
        name: "Dashboard",
        href: "/superadmin",
        icon: Monitor
      }, {
        name: "Courses",
        href: "/superadmin?tab=courses",
        icon: GraduationCap
      }, {
        name: "Pathways",
        href: "/superadmin?tab=pathways",
        icon: Route
      }, {
        name: "Content",
        icon: BookOpen,
        isExpandable: true,
        subItems: [{
          name: "Modules",
          href: "/superadmin?tab=modules",
          icon: BookOpen
        }, {
          name: "Recordings",
          href: "/superadmin?tab=recordings",
          icon: Video
        }, {
          name: "Assignments",
          href: "/superadmin?tab=assignments",
          icon: FileText
        }, {
          name: "Submissions",
          href: "/superadmin?tab=submissions",
          icon: FileText
        }, {
          name: "Success Sessions",
          href: "/superadmin?tab=success-sessions",
          icon: Calendar
        }, {
          name: "Milestones",
          href: "/superadmin?tab=milestones",
          icon: Trophy
        }]
      }, {
        name: "Batches",
        href: "/superadmin?tab=batches",
        icon: Layers
      }, {
        name: "Students",
        href: "/superadmin?tab=students",
        icon: Users
      }, {
        name: "At-Risk",
        href: "/superadmin?tab=at-risk",
        icon: AlertTriangle
      }, {
        name: "Analytics",
        href: "/superadmin?tab=analytics",
        icon: BarChart3
      }, {
        name: "Support",
        href: "/superadmin?tab=support",
        icon: MessageSquare
      }, {
        name: "Teams",
        href: "/teams",
        icon: UserCheck
      }, {
        name: "Error Logs",
        href: "/superadmin?tab=error-logs",
        icon: AlertTriangle
      }, {
        name: "Company",
        href: "/superadmin?tab=company-settings",
        icon: Building2
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserAdmin) {
      return [{
        name: "Dashboard",
        href: "/admin",
        icon: Monitor
      }, {
        name: "Courses",
        href: "/admin?tab=courses",
        icon: GraduationCap
      }, {
        name: "Pathways",
        href: "/admin?tab=pathways",
        icon: Route
      }, {
        name: "Content",
        icon: BookOpen,
        isExpandable: true,
        subItems: [{
          name: "Modules",
          href: "/admin?tab=modules",
          icon: BookOpen
        }, {
          name: "Recordings",
          href: "/admin?tab=recordings",
          icon: Video
        }, {
          name: "Assignments",
          href: "/admin?tab=assignments",
          icon: FileText
        }, {
          name: "Submissions",
          href: "/admin?tab=submissions",
          icon: FileText
        }, {
          name: "Success Sessions",
          href: "/admin?tab=success-sessions",
          icon: Calendar
        }, {
          name: "Milestones",
          href: "/admin?tab=milestones",
          icon: Trophy
        }]
      }, {
        name: "Batches",
        href: "/admin?tab=batches",
        icon: Layers
      }, {
        name: "Students",
        href: "/admin?tab=students",
        icon: Users
      }, {
        name: "At-Risk",
        href: "/admin?tab=at-risk",
        icon: AlertTriangle
      }, {
        name: "Analytics",
        href: "/admin?tab=analytics",
        icon: BarChart3
      }, {
        name: "Support",
        href: "/admin?tab=support",
        icon: MessageSquare
      }, {
        name: "Teams",
        href: "/teams",
        icon: UserCheck
      }, {
        name: "Error Logs",
        href: "/admin?tab=error-logs",
        icon: AlertTriangle
      }, {
        name: "Company",
        href: "/admin?tab=company-settings",
        icon: Building2
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserMentor) {
      return [{
        name: "Dashboard",
        href: "/mentor",
        icon: Monitor
      }, {
        name: "Calendar",
        href: "/mentor/calendar",
        icon: Calendar
      }, {
        name: "Success Sessions",
        href: "/mentor/sessions",
        icon: Calendar
      }, {
        name: "Modules",
        href: "/mentor/modules",
        icon: BookOpen
      }, {
        name: "Recordings",
        href: "/mentor/recordings",
        icon: Video
      }, {
        name: "Assignments",
        href: "/mentor/assignments",
        icon: FileText
      }, {
        name: "Submissions",
        href: "/mentor/submissions",
        icon: MessageSquare
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserEnrollmentManager) {
      return [{
        name: "Dashboard",
        href: "/enrollment-manager",
        icon: Monitor
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    } else if (isUserSupportMember) {
      return [{
        name: "Dashboard",
        href: "/support-member",
        icon: Monitor
      }, {
        name: "Students",
        href: "/support-member?tab=students",
        icon: Users
      }, {
        name: "Analytics",
        href: "/support-member?tab=analytics",
        icon: BarChart3
      }, {
        name: "Support",
        href: "/support-member?tab=support",
        icon: MessageSquare
      }, {
        name: "Courses",
        href: "/support-member?tab=courses",
        icon: BookOpen
      }, {
        name: "Pathways",
        href: "/support-member?tab=pathways",
        icon: Route
      }, {
        name: "Modules",
        href: "/support-member?tab=modules",
        icon: Layers
      }, {
        name: "Recordings",
        href: "/support-member?tab=recordings",
        icon: Video
      }, {
        name: "Assignments",
        href: "/support-member?tab=assignments",
        icon: FileText
      }, {
        name: "Submissions",
        href: "/support-member?tab=submissions",
        icon: MessageSquare
      }, {
        name: "Live Sessions",
        href: "/live-sessions",
        icon: Calendar
      }, {
        name: "Profile",
        href: "/profile",
        icon: User
      }];
    }

    // Default navigation for other users (students)
    const baseNavigation: any[] = [{
      name: "Dashboard",
      href: "/",
      icon: Monitor
    }, {
      name: "Catalog",
      href: "/catalog",
      icon: LayoutGrid,
      isCatalogMenu: true, // Special flag for catalog expandable menu with courses
    }, {
      name: "Success Sessions",
      href: "/live-sessions",
      icon: Calendar
    }, {
      name: "Connect Accounts",
      href: "/connect",
      icon: Activity
    }, {
      name: "Support",
      href: "/support",
      icon: MessageSquare
    }, {
      name: "Support Details",
      href: "/support-details",
      icon: MessageCircle
    }];

    // Insert dynamic integrations right after Connect Accounts
    const dynamicItems: any[] = [];
    if (connectionStatus.shopify) {
      dynamicItems.push({
        name: "Shopify Dashboard",
        href: "/shopify-dashboard",
        icon: ShoppingBag
      });
    }
    if (connectionStatus.meta) {
      dynamicItems.push({
        name: "Meta Ads Dashboard",
        href: "/meta-ads-dashboard",
        icon: MetaIcon
      });
    }

    // Find the index of "Connect Accounts" and insert right after it
    const connectIdx = baseNavigation.findIndex(i => i.href === "/connect");
    const withIntegrations = [...baseNavigation];
    if (connectIdx !== -1 && dynamicItems.length) {
      withIntegrations.splice(connectIdx + 1, 0, ...dynamicItems);
    }

    // Add Profile at the end
    const profileItem = {
      name: "Profile",
      href: "/profile",
      icon: User
    };
    return [...withIntegrations, profileItem];
  }, [isUserSuperadmin, isUserAdmin, isUserMentor, isUserEnrollmentManager, isUserSupportMember, connectionStatus]);

  // Auto-expand course menu if any course tab is active
  useEffect(() => {
    if (isCourseMenuActive) {
      setCourseMenuOpen(true);
    }
  }, [isCourseMenuActive]);

  // Optimized logging with error handling and debouncing
  const logActivityRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (user?.id) {
      // Clear any existing timeout
      if (logActivityRef.current) {
        clearTimeout(logActivityRef.current);
      }

      // Debounce activity logging to prevent spam
      logActivityRef.current = setTimeout(() => {
        const searchParams = new URLSearchParams(location.search);
        const pageMetadata: Record<string, string> = {
          page: location.pathname,
          timestamp: new Date().toISOString()
        };
        // Enrich page visit with context from URL params
        if (searchParams.get('title')) {
          pageMetadata.video_title = decodeURIComponent(searchParams.get('title') || '');
        }
        if (searchParams.get('id')) {
          pageMetadata.reference_id = searchParams.get('id') || '';
        }
        logUserActivity({
          user_id: user.id,
          activity_type: ACTIVITY_TYPES.PAGE_VISIT,
          metadata: pageMetadata
        }).catch(error => {
          // Silently handle activity logging errors
          console.warn('Page visit logging failed:', error);
        });
      }, 500); // Increased delay for better debouncing

      return () => {
        if (logActivityRef.current) {
          clearTimeout(logActivityRef.current);
        }
      };
    }
  }, [location.pathname, location.search, user?.id]);
  const handleLogout = async () => {
    try {
      // Log logout activity before signing out
      if (user?.id) {
        await logUserActivity({
          user_id: user.id,
          activity_type: ACTIVITY_TYPES.LOGOUT,
          metadata: { timestamp: new Date().toISOString() }
        });
      }
      const {
        error
      } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: "Logged out successfully",
        description: "You have been signed out of your account"
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      });
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Mobile hamburger menu */}
              {isMobile ? (
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 p-2">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 overflow-y-auto scrollbar-none">
                    <div className="p-4 border-b">
                      <Link to="/" className="flex items-center gap-2" aria-label="Home" onClick={() => setMobileMenuOpen(false)}>
                        <AppLogo className="h-10 w-auto max-w-[160px]" alt="Company logo" />
                        <span className="text-lg font-bold text-gray-900">GrowthOS</span>
                      </Link>
                    </div>
                    <nav className="p-4">
                      <div className="space-y-2">
                        {navigation.map(item => {
                          // Handle Catalog expandable menu for students
                          if (item.isCatalogMenu) {
                            const isExpanded = catalogMenuOpen;
                            const Icon = item.icon;
                            const isCatalogActive = location.pathname === '/catalog';
                            return <div key={item.name}>
                              <div className="flex items-center">
                                <Link 
                                  to={item.href || '/catalog'} 
                                  className={`flex-1 flex items-center px-4 py-3 text-sm font-medium rounded-l-lg transition-all duration-200 ${
                                    isCatalogActive 
                                      ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600" 
                                      : "text-gray-600 hover:bg-gray-50"
                                  }`}
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  <Icon className={`mr-3 h-5 w-5 ${isCatalogActive ? 'text-gray-900' : 'text-gray-400'}`} />
                                  {item.name}
                                </Link>
                                <button 
                                  onClick={() => setCatalogMenuOpen(!catalogMenuOpen)} 
                                  className="px-2 py-3 text-gray-600 hover:bg-gray-50 rounded-r-lg transition-all duration-200"
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </div>
                              
                              {isExpanded && <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                                {catalogCourses.map(course => {
                                  const isCourseExpanded = expandedCourses.has(course.id);
                                  const isVideosActive = location.pathname === '/videos' && location.search.includes(`courseId=${course.id}`);
                                  const isAssignmentsActive = location.pathname === '/assignments' && location.search.includes(`courseId=${course.id}`);
                                  
                                  return (
                                    <div key={course.id}>
                                      <button
                                        onClick={() => course.isEnrolled && toggleCourseExpand(course.id)}
                                        className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${
                                          course.isEnrolled 
                                            ? 'text-gray-600 hover:bg-gray-50 cursor-pointer' 
                                            : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                        disabled={!course.isEnrolled}
                                      >
                                        <div className="flex items-center gap-2">
                                          {!course.isEnrolled && <Lock className="h-3 w-3 text-gray-400" />}
                                          <span className="truncate max-w-[160px]">{course.title}</span>
                                        </div>
                                        {course.isEnrolled && (
                                          isCourseExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                        )}
                                      </button>
                                      
                                      {isCourseExpanded && course.isEnrolled && (
                                        <div className="ml-4 mt-1 space-y-1 animate-accordion-down">
                                          <Link
                                            to={`/videos?courseId=${course.id}`}
                                            className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                                              isVideosActive 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                            onClick={() => setMobileMenuOpen(false)}
                                          >
                                            <Video className="mr-2 h-3.5 w-3.5" />
                                            Videos
                                          </Link>
                                          <Link
                                            to={`/assignments?courseId=${course.id}`}
                                            className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                                              isAssignmentsActive 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                            onClick={() => setMobileMenuOpen(false)}
                                          >
                                            <FileText className="mr-2 h-3.5 w-3.5" />
                                            Assignments
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {catalogCourses.length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-400 italic">
                                    No courses available
                                  </div>
                                )}
                              </div>}
                            </div>;
                          }
                          
                          if (item.isExpandable) {
                            const isExpanded = courseMenuOpen;
                            const Icon = item.icon;
                            return <div key={item.name}>
                              <button onClick={() => setCourseMenuOpen(!courseMenuOpen)} className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50">
                                <div className="flex items-center">
                                  <Icon className="mr-3 h-5 w-5 text-gray-400" />
                                  {item.name}
                                </div>
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              
                              {isExpanded && <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                                {item.subItems?.map(subItem => {
                                  const isActive = location.search.includes(`tab=${subItem.href.split('=')[1]}`);
                                  const SubIcon = subItem.icon;
                                  return <Link 
                                    key={subItem.name} 
                                    to={subItem.href} 
                                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600" : "text-gray-600 hover:bg-gray-100"}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                  >
                                    <SubIcon className={`mr-3 h-4 w-4 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                                    {subItem.name}
                                  </Link>;
                                })}
                              </div>}
                            </div>;
                          }
                          
                          const searchParams = new URLSearchParams(location.search);
                          const currentTab = searchParams.get('tab');
                          const isTabLink = item.href?.includes('?tab=');
                          const itemTab = isTabLink ? item.href.split('=')[1] : null;
                          const isActive = isTabLink && currentTab === itemTab || !isTabLink && location.pathname === item.href && (!currentTab || currentTab === 'dashboard');
                          const Icon = item.icon;
                          return <Link 
                            key={item.name} 
                            to={item.href || '/'} 
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600" : "text-gray-600 hover:bg-gray-100"}`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                            {item.name}
                          </Link>;
                        })}
                      </div>
                    </nav>
                  </SheetContent>
                </Sheet>
              ) : (
                <Button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
                </Button>
              )}
              <Link to="/" className="flex items-center gap-2" aria-label="Home">
                <AppLogo className={`${isMobile ? 'h-10 max-w-[120px]' : 'h-16 max-w-[240px]'} w-auto`} alt="Company logo" />
                <span className={`font-bold text-gray-900 ${isMobile ? 'text-base hidden xs:block' : 'text-xl'}`}>GrowthOS</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-4">
              <NotificationDropdown />
              
              {/* Dark mode toggle */}
              <ThemeToggle />
              
              {/* Success Partner Button - Only for students */}
              {user?.role === 'student' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-muted-foreground hover:text-primary hover:border-primary/30 p-2 sm:px-3" 
                  onClick={() => setShowSuccessPartner(true)}
                >
                  <MessageCircle className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Success Partner</span>
                </Button>
              )}
              
              {/* Activity Logs Button for authorized users - Only admins and superadmins */}
              {(isUserSuperadmin || isUserAdmin) && !isMobile && (
                <ActivityLogsDialog>
                  <Button variant="outline" size="sm" className="text-muted-foreground hover:text-primary hover:border-primary/30" title="View Activity Logs">
                    <Activity className="w-4 h-4 mr-2" />
                    Activity Logs
                  </Button>
                </ActivityLogsDialog>
              )}
              
              <Button onClick={handleLogout} variant="outline" size="sm" className="text-muted-foreground hover:text-destructive hover:border-destructive/30 p-2 sm:px-3">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <AnnouncementBanner onVisibilityChange={setIsBannerVisible} />

      <div className="flex">
        {/* Sidebar - Desktop only, hidden on mobile */}
        {!isMobile && (
          <aside className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-card shadow-lg transition-all duration-300 fixed left-0 z-30 overflow-y-auto scrollbar-none`} style={{ top: isBannerVisible ? '112px' : '64px', height: isBannerVisible ? 'calc(100vh - 112px)' : 'calc(100vh - 64px)' }}>
            <nav className={`mt-8 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
              <div className="space-y-2">
              {navigation.map(item => {
              // Handle Catalog expandable menu for students
              if (item.isCatalogMenu) {
                const isExpanded = catalogMenuOpen && !sidebarCollapsed;
                const Icon = item.icon;
                const isCatalogActive = location.pathname === '/catalog';
                return <div key={item.name}>
                      <div className="flex items-center">
                        <Link 
                          to={item.href || '/catalog'} 
                          className={`flex-1 flex items-center px-4 py-3 text-sm font-medium rounded-l-lg transition-all duration-200 ${
                            isCatalogActive 
                              ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600" 
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                          title={sidebarCollapsed ? item.name : undefined}
                        >
                          <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 ${isCatalogActive ? 'text-gray-900' : 'text-gray-400'}`} />
                          {!sidebarCollapsed && item.name}
                        </Link>
                        {!sidebarCollapsed && (
                          <button 
                            onClick={() => setCatalogMenuOpen(!catalogMenuOpen)} 
                            className="px-2 py-3 text-gray-600 hover:bg-gray-50 rounded-r-lg transition-all duration-200"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                      
                      {isExpanded && !sidebarCollapsed && <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                          {catalogCourses.map(course => {
                            const isCourseExpanded = expandedCourses.has(course.id);
                            const isVideosActive = location.pathname === '/videos' && location.search.includes(`courseId=${course.id}`);
                            const isAssignmentsActive = location.pathname === '/assignments' && location.search.includes(`courseId=${course.id}`);
                            
                            return (
                              <div key={course.id}>
                                <button
                                  onClick={() => course.isEnrolled && toggleCourseExpand(course.id)}
                                  className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${
                                    course.isEnrolled 
                                      ? 'text-gray-600 hover:bg-gray-50 cursor-pointer' 
                                      : 'text-gray-400 cursor-not-allowed'
                                  }`}
                                  disabled={!course.isEnrolled}
                                >
                                  <div className="flex items-center gap-2">
                                    {!course.isEnrolled && <Lock className="h-3 w-3 text-gray-400" />}
                                    <span className="truncate max-w-[160px]">{course.title}</span>
                                  </div>
                                  {course.isEnrolled && (
                                    isCourseExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                  )}
                                </button>
                                
                                {isCourseExpanded && course.isEnrolled && (
                                  <div className="ml-4 mt-1 space-y-1 animate-accordion-down">
                                    <Link
                                      to={`/videos?courseId=${course.id}`}
                                      className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                                        isVideosActive 
                                          ? 'bg-primary text-primary-foreground' 
                                          : 'text-gray-600 hover:bg-gray-100'
                                      }`}
                                    >
                                      <Video className="mr-2 h-3.5 w-3.5" />
                                      Videos
                                    </Link>
                                    <Link
                                      to={`/assignments?courseId=${course.id}`}
                                      className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                                        isAssignmentsActive 
                                          ? 'bg-primary text-primary-foreground' 
                                          : 'text-gray-600 hover:bg-gray-100'
                                      }`}
                                    >
                                      <FileText className="mr-2 h-3.5 w-3.5" />
                                      Assignments
                                    </Link>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {catalogCourses.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400 italic">
                              No courses available
                            </div>
                          )}
                        </div>}
                    </div>;
              }
              
              if (item.isExpandable) {
                const isExpanded = courseMenuOpen && !sidebarCollapsed;
                const Icon = item.icon;
                return <div key={item.name}>
                      <button onClick={() => !sidebarCollapsed && setCourseMenuOpen(!courseMenuOpen)} className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 hover-scale" title={sidebarCollapsed ? item.name : undefined}>
                        <div className="flex items-center">
                          <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 text-gray-400`} />
                          {!sidebarCollapsed && item.name}
                        </div>
                        {!sidebarCollapsed && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                      </button>
                      
                      {isExpanded && !sidebarCollapsed && <div className="ml-4 mt-2 space-y-1 animate-accordion-down">
                          {item.subItems?.map(subItem => {
                      const isActive = location.search.includes(`tab=${subItem.href.split('=')[1]}`);
                      const SubIcon = subItem.icon;
                      return <Link key={subItem.name} to={subItem.href} onMouseEnter={() => prefetchByHref(subItem.href)} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 story-link ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105" : "text-gray-600 hover:bg-gray-100 hover-scale"}`}>
                                <SubIcon className={`mr-3 h-4 w-4 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                                {subItem.name}
                              </Link>;
                    })}
                        </div>}
                    </div>;
              }
              const searchParams = new URLSearchParams(location.search);
              const currentTab = searchParams.get('tab');
              const isTabLink = item.href?.includes('?tab=');
              const itemTab = isTabLink ? item.href.split('=')[1] : null;
              // Active when:
              // - tab link matches current tab
              // - OR base path matches and no tab is selected (or tab=dashboard)
              const isActive = isTabLink && currentTab === itemTab || !isTabLink && location.pathname === item.href && (!currentTab || currentTab === 'dashboard');
              const Icon = item.icon;
              return <Link key={item.name} to={item.href || '/'} onMouseEnter={() => prefetchByHref(item.href || '')} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 story-link ${isActive ? "bg-gray-200 text-gray-900 border-l-4 border-blue-600 shadow-lg scale-105" : "text-gray-600 hover:bg-gray-100 hover-scale"}`} title={sidebarCollapsed ? item.name : undefined}>
                    <Icon className={`${sidebarCollapsed ? 'mr-0' : 'mr-3'} h-5 w-5 transition-colors ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>;
            })}
            </div>
          </nav>
        </aside>
        )}

        {/* Main Content - adjust padding based on sidebar state and mobile */}
        <main 
          className={`flex-1 w-full max-w-full overflow-x-hidden animate-fade-in transition-all duration-300 ${
            isMobile ? 'pl-0' : (sidebarCollapsed ? 'pl-16' : 'pl-80')
          }`} 
          style={{ paddingTop: isBannerVisible ? (isMobile ? '104px' : '144px') : (isMobile ? '72px' : '96px') }}
        >
          <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-6 py-0 lg:px-4">
            <Suspense fallback={<RouteContentLoader path={location.pathname} />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      
      {/* Floating Activity Button */}
      <ScrollToTop />
      
      {/* Motivational Notifications for Students */}
      {user?.role === 'student' && <MotivationalNotifications />}
      
      {/* Live Chat Widget for Students */}
      <LiveChatWidget userRole={user?.role} />
      
      {/* Success Partner Dialog */}
      {showSuccessPartner && user?.id && user?.email && <SuccessPartner onClose={() => setShowSuccessPartner(false)} user={{
      id: user.id,
      full_name: user.full_name || user.email.split('@')[0] || 'Student',
      email: user.email
    }} />}
      
      {/* Watermark */}
      <a href="https://core47.ai" target="_blank" rel="noopener noreferrer" className="fixed bottom-4 right-4 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors z-50">
        Developed by Core47.ai
      </a>
    </div>;
});
Layout.displayName = 'Layout';
export default Layout;