"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import { canCreateActivity as canCreateActivityForRole } from "../../shared/permissions/roleCapabilities";

interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  level: number;
  wbs_code: string;
  task_name: string;
}

interface Activity {
  id: string;
  project_id: string;
  zone_id: string;
  task_id?: string | null;
  activity_name: string;
  planned_start: string;
  planned_end: string;
  duration_days?: number;
  created_at: string;
  updated_at: string;
  constraint_status?: string;
  actual_start?: string;
  actual_end?: string;
  latest_progress?: ProgressUpdate | null;
  quantity?: number;
  unit?: string;
  boq_rate?: number;
  task?: Task | null;
}

interface Zone {
  id: string;
  project_id: string;
  zone_name: string;
  created_at: string;
}

interface ActivityFormData {
  activity_name: string;
  planned_start: string;
  planned_end: string;
  duration_days: string;
  constraint_status: string;
  status?: string;
  task_id?: string | null;
}

interface ProgressUpdate {
  id: string;
  activity_id: string;
  date: string;
  progress: number;
  remarks: string;
  created_by: string;
  location: string;
  image_url?: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ActivityWithProgress extends Activity {
  latest_progress: ProgressUpdate | null;
  task?: Task | null;
}

interface ProgressFormData {
  date: string;
  progress_percent: string;
  remarks: string;
  created_by: string;
  location: string;
  image_url?: string;
}

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Format date helper function
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Get actual date display
  const getActualDateDisplay = (activity: any) => {
    if (!activity.actual_start && !activity.actual_end) return "-";
    if (activity.actual_start && !activity.actual_end)
      return formatDate(activity.actual_start) + " - Ongoing";
    return formatDate(activity.actual_start) + " - " + formatDate(activity.actual_end);
  };

  // Get delay days
  const getDelayDays = (planned_end: string, actual_end: string) => {
    const planned = new Date(planned_end);
    const actual = new Date(actual_end);

    const diff = (actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 ? Math.floor(diff) : 0;
  };

  // Get activity status with automated logic and constraint override
  const getActivityStatus = ({
    progress,
    planned_start,
    planned_end,
    actual_end,
    constraint_status
  }: any) => {
    const today = new Date();

    if (constraint_status === "On Hold") return "On Hold";
    if (constraint_status === "Cancelled") return "Cancelled";

    if (actual_end || progress === 100) return "Completed";

    if (progress > 0 && progress < 100) return "In Progress";

    if (today < new Date(planned_start)) return "Yet to Start";

    if (today > new Date(planned_end) && progress < 100) return "Delayed";

    return "Yet to Start";
  };

  // Format date and time in IST
  const formatDateTimeIST = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }).replace(',', ' •');
  };
  
  const [activities, setActivities] = useState<ActivityWithProgress[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dark, setDark] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const canCreateActivity = canCreateActivityForRole(userRole);

  // Set dynamic page title
  useEffect(() => {
    document.title = "Activities | RTP";
  }, [searchParams]); // Include searchParams to handle URL changes

  // PROTECT ACTIVITIES PAGE - Authentication and Role Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking activities page authentication...');
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error('No authenticated user found:', authError);
          window.location.href = "/";
          return;
        }
        
        console.log('User authenticated:', user.id);
        
        // Get user data including role
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, role, organization_id")
          .eq("id", user.id)
          .single();

        if (userError || !userData) {
          console.error('Error fetching user data:', userError);
          window.location.href = "/";
          return;
        }
        
        console.log('User role confirmed:', userData.role);

        setUserRole(userData.role);
        setUserData(userData);

        // Activities page is accessible to all authenticated users
        // No additional role restrictions needed for activities page
        
      } catch (error) {
        console.error('Exception during authentication check:', error);
        window.location.href = "/";
      }
    };
    
    checkAuth();
  }, []);

  // Reset zones when project changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchZones(selectedProjectId);
      setSelectedZone(""); // Reset selected zone when project changes
    } else {
      setZones([]); // Clear zones when no project selected
    }
  }, [selectedProjectId]);

  // State persistence utilities
  const updateURLParams = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    const url = `${newParams.toString() ? '?' + newParams.toString() : ''}`;
    router.push(url, { scroll: false });
  }, [searchParams, router]);

  const saveToLocalStorage = useCallback((key: string, value: any) => {
    try {
      localStorage.setItem(`activities_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`activities_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return defaultValue;
    }
  }, []);

  // Initialize state from URL params and localStorage
  useEffect(() => {
    // Extract project_id from URL parameters
    const projectIdFromURL = searchParams.get('project_id');
    if (projectIdFromURL) {
      setSelectedProjectId(projectIdFromURL);
      console.log("Project ID from URL:", projectIdFromURL);
    }

    // Restore selectedZone from URL params first, then localStorage
    const zoneFromURL = searchParams.get('zone');
    const zoneFromStorage = loadFromLocalStorage('selectedZone', '');
    setSelectedZone(zoneFromURL || zoneFromStorage);

    // Restore modal states from localStorage
    const activityFormOpen = loadFromLocalStorage('showActivityForm', false);
    const progressFormOpen = loadFromLocalStorage('showProgressForm', false);
    const activityId = loadFromLocalStorage('selectedActivity', '');

    setShowActivityForm(activityFormOpen);
    setShowProgressForm(progressFormOpen);
    setSelectedActivity(activityId);

    // Restore dark mode
    const darkMode = loadFromLocalStorage('darkMode', false);
    setDark(darkMode);
  }, [searchParams]); // Run when searchParams change

  // Support URLs that have only `zone` without `project_id`
  useEffect(() => {
    const resolveProjectFromZone = async () => {
      if (selectedProjectId) return;
      if (!selectedZone || selectedZone === "all") return;

      const { data, error } = await supabase
        .from("zones")
        .select("project_id")
        .eq("id", selectedZone)
        .maybeSingle();

      if (error) {
        console.error("Error resolving project from zone:", error);
        return;
      }

      if (data?.project_id) {
        setSelectedProjectId(data.project_id);
      }
    };

    resolveProjectFromZone();
  }, [selectedZone, selectedProjectId]);

  // Save state changes to URL params and localStorage
  useEffect(() => {
    if (selectedZone) {
      updateURLParams({ zone: selectedZone });
      saveToLocalStorage('selectedZone', selectedZone);
    }
  }, [selectedZone]);

  useEffect(() => {
    saveToLocalStorage('showActivityForm', showActivityForm);
    if (!showActivityForm) {
      // Clear selected activity when closing activity form
      saveToLocalStorage('selectedActivity', '');
    }
  }, [showActivityForm]);

  useEffect(() => {
    saveToLocalStorage('showProgressForm', showProgressForm);
    if (!showProgressForm) {
      // Clear selected activity when closing progress form
      saveToLocalStorage('selectedActivity', '');
    }
  }, [showProgressForm]);

  useEffect(() => {
    saveToLocalStorage('selectedActivity', selectedActivity);
  }, [selectedActivity]);

  useEffect(() => {
    saveToLocalStorage('darkMode', dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Show toast message
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Skeleton loading component
  const SkeletonCard = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
        </div>
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
      </div>
      <div className="mt-4 flex space-x-3">
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded flex-1"></div>
        <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded flex-1"></div>
      </div>
    </div>
  );

  // Check if an activity is delayed
  const isActivityDelayed = (activity: Activity) => {
    const plannedEnd = new Date(activity.planned_end);
    const progress = activity.latest_progress?.progress || 0;
    return progress < 100 && new Date() > plannedEnd;
  };

  // Sort activities: Delayed → In Progress → Not Started
  const sortActivities = (activities: Activity[]) => {
    return activities.sort((a, b) => {
      const aDelayed = isActivityDelayed(a);
      const bDelayed = isActivityDelayed(b);
      
      // Delayed activities first
      if (aDelayed && !bDelayed) return -1;
      if (!aDelayed && bDelayed) return 1;
      
      // If both delayed, sort by delay severity (days overdue)
      if (aDelayed && bDelayed) {
        const aDaysOverdue = Math.floor((new Date().getTime() - new Date(a.planned_end).getTime()) / (1000 * 60 * 60 * 24));
        const bDaysOverdue = Math.floor((new Date().getTime() - new Date(b.planned_end).getTime()) / (1000 * 60 * 60 * 24));
        return bDaysOverdue - aDaysOverdue;
      }
      
      // Then by progress (in progress before not started)
      const aProgress = a.latest_progress?.progress || 0;
      const bProgress = b.latest_progress?.progress || 0;
      return bProgress - aProgress;
    });
  };

  // Chart data calculation functions
  const getPieChartData = () => {
    const notStarted = activities.filter(a => !a.latest_progress || a.latest_progress.progress === 0).length;
    const inProgress = activities.filter(a => a.latest_progress && a.latest_progress.progress > 0 && a.latest_progress.progress < 100).length;
    const completed = activities.filter(a => a.latest_progress && a.latest_progress.progress === 100).length;

    return [
      { label: 'Not Started', value: notStarted, color: '#ef4444' },
      { label: 'In Progress', value: inProgress, color: '#f59e0b' },
      { label: 'Completed', value: completed, color: '#10b981' }
    ];
  };

  const getBarChartData = () => {
    return activities
      .map(activity => ({
        name: activity.activity_name,
        progress: activity.latest_progress?.progress || 0
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);
  };

  const getStatistics = () => {
    const today = new Date();
    const delayedActivities = activities.filter(activity => {
      const plannedEnd = new Date(activity.planned_end);
      const progress = activity.latest_progress?.progress || 0;
      
      // Mark as delayed if progress < 100 AND today > planned_end
      return progress < 100 && today > plannedEnd;
    }).length;

    const totalActivities = activities.length;
    const completedActivities = activities.filter(a => a.latest_progress?.progress === 100).length;
    const inProgressActivities = activities.filter(a => a.latest_progress && a.latest_progress.progress > 0 && a.latest_progress.progress < 100).length;
    const notStartedActivities = activities.filter(a => !a.latest_progress || a.latest_progress.progress === 0).length;
    
    // Calculate health score
    let healthScore = 0;
    if (totalActivities > 0) {
      healthScore = 
        (completedActivities / totalActivities * 60) +
        (inProgressActivities / totalActivities * 30) -
        (delayedActivities / totalActivities * 40);
      
      // Clamp between 0 and 100
      healthScore = Math.max(0, Math.min(100, healthScore));
      healthScore = Math.round(healthScore);
    }
    
    // Determine status message
    let statusMessage = '';
    if (delayedActivities / totalActivities > 0.3) {
      statusMessage = 'Project at risk due to delays';
    } else if (completedActivities / totalActivities > 0.6) {
      statusMessage = 'Project on track';
    } else if (notStartedActivities / totalActivities > 0.5) {
      statusMessage = 'Execution yet to begin';
    } else {
      statusMessage = 'Project progressing';
    }
    
    // Determine color
    let scoreColor = '';
    if (healthScore >= 75) {
      scoreColor = 'text-green-600 dark:text-green-400';
    } else if (healthScore >= 50) {
      scoreColor = 'text-orange-600 dark:text-orange-400';
    } else {
      scoreColor = 'text-red-600 dark:text-red-400';
    }

    const averageProgress = activities.length > 0 
      ? Math.round(activities.reduce((sum, activity) => sum + (activity.latest_progress?.progress || 0), 0) / activities.length)
      : 0;

    return {
      totalActivities,
      onTimeActivities: totalActivities - delayedActivities,
      delayedActivities,
      averageProgress,
      healthScore,
      scoreColor,
      statusMessage,
      completedActivities,
      inProgressActivities,
      notStartedActivities
    };
  };

  // Chart rendering functions
  const renderPieChart = () => {
    const data = getPieChartData();
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          No data available
        </div>
      );
    }

    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    let currentAngle = -90; // Start from top

    const paths = data.map((item) => {
      if (item.value === 0) return null;
      
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const endAngle = currentAngle + angle;
      
      const x1 = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
      const y1 = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);
      const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
      const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
      
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
      
      currentAngle = endAngle;
      
      return (
        <path
          key={item.label}
          d={pathData}
          fill={item.color}
          stroke="white"
          strokeWidth="2"
        />
      );
    });

    return (
      <svg width="200" height="200" viewBox="0 0 200 200">
        {paths}
      </svg>
    );
  };

  const renderBarChart = () => {
    const data = getBarChartData();
    
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          No data available
        </div>
      );
    }

    // Function to shorten activity names
    const shortenName = (name: string) => {
      if (name.length <= 8) return name;
      
      // Common abbreviations
      const abbreviations: { [key: string]: string } = {
        'Foundation': 'Found.',
        'Installation': 'Install.',
        'Construction': 'Constr.',
        'Excavation': 'Excav.',
        'Electrical': 'Elec.',
        'Plumbing': 'Plumb.',
        'Security': 'Sec.',
        'Landscaping': 'Land.',
        'Parking': 'Park.',
        'Systems': 'Sys.',
        'Equipment': 'Equip.',
        'Building': 'Bldg.',
        'Structure': 'Struct.',
        'Maintenance': 'Maint.',
        'Inspection': 'Insp.',
        'Testing': 'Test.',
        'Commissioning': 'Comm.',
        'Renovation': 'Renov.',
        'Demolition': 'Demol.'
      };
      
      // Try to replace with abbreviation
      for (const [full, short] of Object.entries(abbreviations)) {
        if (name.includes(full)) {
          return name.replace(full, short).substring(0, 10);
        }
      }
      
      // If no abbreviation found, just truncate
      return name.substring(0, 8) + '..';
    };

    const maxProgress = 100;
    const barWidth = 45;
    const barSpacing = 35;
    const containerHeight = 256;
    const chartWidth = data.length * (barWidth + barSpacing) + 60;
    const topPadding = 25;
    const bottomPadding = 55;
    const availableHeight = containerHeight - topPadding - bottomPadding;

    return (
      <div className="overflow-x-auto">
        <svg 
          width={chartWidth} 
          height={containerHeight} 
          viewBox={`0 0 ${chartWidth} ${containerHeight}`}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line
                x1="40"
                y1={topPadding + availableHeight * (1 - value / 100)}
                x2={chartWidth - 15}
                y2={topPadding + availableHeight * (1 - value / 100)}
                stroke="#e5e7eb"
                strokeDasharray="2,2"
              />
              <text
                x="35"
                y={topPadding + availableHeight * (1 - value / 100) + 3}
                fontSize="9"
                textAnchor="end"
                fill="#6b7280"
              >
                {value}%
              </text>
            </g>
          ))}
          
          {/* Bars */}
          {data.map((item, index) => {
            const barHeight = (item.progress / maxProgress) * availableHeight;
            const x = index * (barWidth + barSpacing) + 50;
            const y = topPadding + availableHeight - barHeight;
            const shortName = shortenName(item.name);
            
            // Split name into words for wrapping
            const words = shortName.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
              if ((currentLine + ' ' + word).length <= 10) {
                currentLine = currentLine ? currentLine + ' ' + word : word;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
              }
            });
            if (currentLine) lines.push(currentLine);
            
            return (
              <g key={item.name}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#3b82f6"
                  rx="3"
                />
                
                {/* Progress value */}
                <text
                  x={x + barWidth / 2}
                  y={y - 3}
                  fontSize="10"
                  textAnchor="middle"
                  fill="#1f2937"
                  fontWeight="bold"
                >
                  {item.progress}%
                </text>
                
                {/* Activity name with text wrapping and rotation */}
                {lines.slice(0, 2).map((line, lineIndex) => (
                  <text
                    key={lineIndex}
                    x={x + barWidth / 2}
                    y={containerHeight - bottomPadding + 20 + lineIndex * 10}
                    fontSize="7"
                    textAnchor="middle"
                    fill="#374151"
                    transform={`rotate(-25 ${x + barWidth / 2} ${containerHeight - bottomPadding + 20 + lineIndex * 10})`}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };
  
  const [formData, setFormData] = useState<ActivityFormData>({
    activity_name: "",
    planned_start: "",
    planned_end: "",
    duration_days: "",
    constraint_status: "",
    status: "",
    task_id: ""
  });

  const [progressFormData, setProgressFormData] = useState<ProgressFormData>({
    date: new Date().toISOString().split('T')[0],
    progress_percent: "",
    remarks: "",
    created_by: "",
    location: "",
  });

  const [constraintStatus, setConstraintStatus] = useState<string | null>(null);
  const [showEditActivityForm, setShowEditActivityForm] = useState(false);
  const [selectedActivityForEdit, setSelectedActivityForEdit] = useState<Activity | null>(null);

  const [errors, setErrors] = useState<Partial<ActivityFormData>>({});
  const [progressErrors, setProgressErrors] = useState<Partial<ProgressFormData>>({});
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [selectedActivityForUpdates, setSelectedActivityForUpdates] = useState<string>("");
  const [allProgressUpdates, setAllProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [initialProgressFormData, setInitialProgressFormData] = useState<ProgressFormData | null>(null);
  const [hasFormChanges, setHasFormChanges] = useState(false);

  // Check if form has changes
  const checkFormChanges = useCallback(() => {
    if (!initialProgressFormData) return false;
    
    const currentData = progressFormData;
    const hasChanges = 
      currentData.date !== initialProgressFormData.date ||
      currentData.progress_percent !== initialProgressFormData.progress_percent ||
      currentData.remarks !== initialProgressFormData.remarks ||
      !!selectedImage !== !!imagePreview;
    
    setHasFormChanges(hasChanges);
    return hasChanges;
  }, [progressFormData, initialProgressFormData, selectedImage, imagePreview]);

  // Handle escape key press
  const handleEscapeKey = useCallback(() => {
    // Handle Activity Form modal
    if (showActivityForm) {
      setShowActivityForm(false);
      setSelectedActivity("");
      setFormData({
        activity_name: "",
        planned_start: "",
        planned_end: "",
        duration_days: "",
        constraint_status: "",
        task_id: ""
      });
      setFormErrors({});
      return;
    }
    
    // Handle Edit Activity Form modal
    if (showEditActivityForm) {
      setShowEditActivityForm(false);
      setSelectedActivityForEdit(null);
      return;
    }
    
    // Handle View Updates modal
    if (showUpdatesModal) {
      setShowUpdatesModal(false);
      setSelectedActivityForUpdates("");
      setAllProgressUpdates([]);
      return;
    }
    
    // Handle Progress Form modal
    if (showProgressForm) {
      if (hasFormChanges) {
        if (typeof window !== 'undefined' && window.confirm("You have unsaved changes. Are you sure you want to exit?")) {
          setShowProgressForm(false);
          setSelectedActivity("");
          setProgressErrors({});
          clearImageSelection();
          setHasFormChanges(false);
        }
      } else {
        setShowProgressForm(false);
        setSelectedActivity("");
        setProgressErrors({});
        clearImageSelection();
        setHasFormChanges(false);
      }
    }
  }, [showActivityForm, showEditActivityForm, showProgressForm, showUpdatesModal, hasFormChanges]);

  // Handle enter key press for form navigation and submission
  const handleEnterKey = useCallback((e: KeyboardEvent) => {
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      
      // Handle Activity Form - navigate to next field
      if (showActivityForm && activeElement && activeElement.tagName === 'INPUT') {
        const form = activeElement.closest('form');
        if (form) {
          const inputs = Array.from(form.querySelectorAll('input, select, button[type="submit"]'));
          const currentIndex = inputs.indexOf(activeElement);
          
          if (currentIndex < inputs.length - 1) {
            e.preventDefault();
            const nextInput = inputs[currentIndex + 1];
            if (nextInput) {
              nextInput.focus();
            }
          }
        }
        return;
      }
      
      // Handle Edit Activity Form - navigate to next field
      if (showEditActivityForm && activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
        const form = activeElement.closest('form');
        if (form) {
          const inputs = Array.from(form.querySelectorAll('input, select, button[type="submit"]'));
          const currentIndex = inputs.indexOf(activeElement);
          
          if (currentIndex < inputs.length - 1) {
            e.preventDefault();
            const nextInput = inputs[currentIndex + 1];
            if (nextInput) {
              nextInput.focus();
            }
          }
        }
        return;
      }
      
      // Handle Progress Form - submit form
      if (showProgressForm && !submitting) {
        if (activeElement && activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          // Trigger form submission
          const form = document.querySelector('#progress-form') as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    }
  }, [showActivityForm, showEditActivityForm, showProgressForm, submitting]);

  // Add keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleEscapeKey();
      } else if (e.key === 'Enter') {
        handleEnterKey(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleEscapeKey, handleEnterKey]);

  // Track form changes
  useEffect(() => {
    if (showProgressForm) {
      checkFormChanges();
    }
  }, [progressFormData, selectedImage, showProgressForm, checkFormChanges]);

  // Fetch zones
  const fetchZones = async (projectId: string) => {
    try {
      if (!projectId) {
        console.log("No project ID provided for zones");
        setZones([]);
        return;
      }

      console.log("Fetching all zones for project:", projectId);
      
      const { data, error } = await supabase
        .from("zones")
        .select("id, project_id, zone_name, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching zones:", error);
        setZones([]);
      } else {
        console.log("Zones fetched:", data?.length || 0, "zones for project:", projectId);
        setZones(data || []);
        if (data && data.length > 0 && !selectedZone) {
          setSelectedZone(data[0].id);
        }
      }
    } catch (err) {
      console.error("Exception fetching zones:", err);
      setZones([]);
    }
  };

  // Get zone ID from URL parameters - moved inside useEffect to fix SSR
  const getZoneIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('zone_id') || '';
    }
    return '';
  };

  const zoneId = getZoneIdFromUrl();

  // Fetch activities with optimized queries
  const fetchActivities = async () => {
    if (!selectedZone) return;
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("activities")
        .select(`
          id, project_id, zone_id, task_id, activity_name, planned_start, planned_end, duration_days, status, created_at, updated_at, actual_start, actual_end,
          quantity, unit, boq_rate,
          task:tasks(id, wbs_code, task_name)
        `)
        .eq("project_id", selectedProjectId);

      if (selectedZone !== "all") {
        query = query.eq("zone_id", selectedZone);
      }
      
      // No role-based filtering - fetch all activities for all users
      
      const { data: activitiesData, error: activitiesError } = await query.order("created_at", { ascending: false });

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        setActivities([]);
        return;
      }

      // If no real data, set empty activities array
      if (!activitiesData || activitiesData.length === 0) {
        setActivities([]);
        return;
      }

      // Debug: Log existing status values
      console.log("🔍 DEBUG: Existing activities:", activitiesData);
      if (activitiesData && activitiesData.length > 0) {
        console.log("🔍 DEBUG: Sample activity status values:", activitiesData.map(a => a.status));
      }

      // Set activities immediately without progress
      const activitiesWithoutProgress: ActivityWithProgress[] = activitiesData.map(activity => ({
        ...activity,
        latest_progress: null,
        updated_at: activity.updated_at || new Date().toISOString(),
        task: activity.task && Array.isArray(activity.task) && activity.task.length > 0 ? activity.task[0] : null
      }));
      
      setActivities(activitiesWithoutProgress);
      
      // Fetch latest progress separately (light query)
      fetchLatestProgressForActivities(activitiesData);
      
    } catch (err) {
      console.error("Exception fetching activities:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch tasks for WBS selection
  const fetchTasks = async () => {
    if (!selectedProjectId) return;
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, project_id, parent_id, level, wbs_code, task_name")
        .eq("project_id", selectedProjectId)
        .order("wbs_code");

      if (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
        return;
      }

      setTasks(data || []);
    } catch (err) {
      console.error("Exception fetching tasks:", err);
      setTasks([]);
    }
  };

  // Fetch latest progress for activities (improved query)
  const fetchLatestProgressForActivities = async (activities: any[]) => {
    try {
      const activityIds = activities.map(a => a.id);
      
      if (activityIds.length === 0) return;
      
      // Fetch latest progress for each activity using correct schema
      const { data: progressData, error: progressError } = await supabase
        .from("progress_updates")
        .select("id, activity_id, date, progress, remarks, created_by, location")
        .in("activity_id", activityIds)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (progressError) {
        console.error("Error fetching progress updates:", progressError);
        return;
      }

      // Group progress by activity_id and get the absolute latest for each
      const latestProgressByActivity: { [key: string]: any } = {};
      
      (progressData || []).forEach(progress => {
        if (!latestProgressByActivity[progress.activity_id]) {
          latestProgressByActivity[progress.activity_id] = progress;
        }
      });

      // Update activities with latest progress and auto-calculate status
      const activitiesWithProgress = activities.map(activity => {
        const latestProgress = latestProgressByActivity[activity.id] || null;
        const progressPercent = latestProgress?.progress || 0;
        
        // Auto-update status based on progress
        let autoStatus = 'Pending';
        if (progressPercent === 0) {
          autoStatus = 'Pending';
        } else if (progressPercent > 0 && progressPercent < 100) {
          autoStatus = 'Active';
        } else if (progressPercent === 100) {
          autoStatus = 'Completed';
        }

        return {
          ...activity,
          latest_progress: latestProgress,
          // Update status based on progress
          status: autoStatus
        };
      });

      setActivities(activitiesWithProgress);
      
    } catch (err) {
      console.error("Exception fetching latest progress:", err);
    }
  };

  useEffect(() => {
    if (userRole && userData && selectedProjectId) {
      fetchZones(selectedProjectId);
    }
  }, [userRole, userData, selectedProjectId]);

  useEffect(() => {
    if (selectedZone && userRole && userData) {
      fetchActivities();
      fetchTasks();
    }
  }, [selectedZone, userRole, userData]);

  useEffect(() => {
    if (!canCreateActivity && showActivityForm) {
      setShowActivityForm(false);
    }
  }, [canCreateActivity, showActivityForm]);

  // Auto-select zone from URL parameter
  useEffect(() => {
    if (zoneId && zones.length > 0) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        setSelectedZone(zoneId);
      }
    }
  }, [zoneId, zones]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name as keyof ActivityFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Validate activity form
  const validateActivityForm = (): boolean => {
    const newErrors: Partial<ActivityFormData> = {};

    if (!formData.activity_name.trim()) {
      newErrors.activity_name = "Activity name is required";
    }

    if (!formData.planned_start) {
      newErrors.planned_start = "Start date is required";
    }

    if (!formData.planned_end) {
      newErrors.planned_end = "End date is required";
    }

    if (formData.planned_start && formData.planned_end && formData.planned_start > formData.planned_end) {
      newErrors.planned_end = "End date must be after start date";
    }

    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle activity submission
  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Backend validation: Block create project/activity for user role
    if (userData?.role === "user") {
      alert("You don't have permission to create activities or projects.");
      return;
    }
    
    if (!validateActivityForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Debug: Log the status value being used
      console.log("🔍 DEBUG: Creating activity with status:", formData.status);
      console.log("🔍 DEBUG: Selected status from dropdown:", formData.status);
      console.log("🔍 DEBUG: Full form data:", formData);
      
      // Ensure required fields are not empty before proceeding
      if (!selectedZone) {
        console.error("❌ ERROR: Zone is empty! User must select a zone.");
        alert("Please select a zone for the activity.");
        return;
      }
      
      // Get project_id from selected zone
      const projectId = zones.find(z => z.id === selectedZone)?.project_id || null;
      
      if (!projectId) {
        console.error("❌ ERROR: Project ID not found for selected zone!");
        alert("Error: Unable to determine project for selected zone.");
        return;
      }
      
      // Insert activity into Supabase
      const insertData = {
        activity_name: formData.activity_name.trim(),
        planned_start: formData.planned_start,
        planned_end: formData.planned_end,
        duration_days: parseInt(formData.duration_days) || 0,
        constraint_status: formData.constraint_status || null,
        project_id: projectId, // Use valid UUID or null
        zone_id: selectedZone, // Use valid UUID (validated above)
        task_id: formData.task_id || null, // Include WBS task selection
      };
      
      console.log("🔍 DEBUG: Data being inserted:", insertData);
      
      const { data, error } = await supabase
        .from("activities")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Error creating activity:", error);
        alert("Error creating activity: " + error.message);
      } else {
        console.log("Activity created successfully:", data);
        alert("Activity created successfully!");
        
        // Reset form and close
        setFormData({
          activity_name: "",
          planned_start: "",
          planned_end: "",
          duration_days: "",
          constraint_status: "",
        });
        setShowActivityForm(false);
        
        // Refresh activities list
        fetchActivities();
      }
    } catch (err) {
      console.error("Exception creating activity:", err);
      alert("An unexpected error occurred while creating the activity.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle progress form input changes
  const handleProgressInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProgressFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (progressErrors[name as keyof ProgressFormData]) {
      setProgressErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Validate progress form
  const validateProgressForm = (): boolean => {
    const newErrors: Partial<ProgressFormData> = {};

    if (!progressFormData.date) {
      newErrors.date = "Date is required";
    }

    if (!progressFormData.progress_percent) {
      newErrors.progress_percent = "Progress percentage is required";
    } else {
      const progress = parseInt(progressFormData.progress_percent);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        newErrors.progress_percent = "Progress must be between 0 and 100";
      }
    }

    setProgressErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Get current user from Supabase auth
  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting current user:", error);
        return null;
      }
      return user;
    } catch (err) {
      console.error("Exception getting current user:", err);
      return null;
    }
  };

  // Get current location using browser geolocation
  const getCurrentLocation = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("Location not available");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            // Free reverse geocoding via OpenStreetMap Nominatim (no API key required)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { "User-Agent": "RealTimePlanners/1.0" } }
            );

            if (response.ok) {
              const data = await response.json();
              if (data && data.address) {
                const addr = data.address;
                const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || "";
                const city = addr.city || addr.town || addr.county || "";
                const state = addr.state || "";

                const locationParts: string[] = [];
                if (area) locationParts.push(area);
                if (city) locationParts.push(city);
                if (state) locationParts.push(state);

                const locationName = locationParts.length > 0
                  ? locationParts.join(", ")
                  : data.display_name;

                resolve(locationName);
                return;
              }
            }
          } catch (error) {
            console.error("Error getting address from Nominatim:", error);
          }

          // Fallback to coordinate-based lookup
          const locationName = getLocationNameFromCoordinates(latitude, longitude);
          resolve(locationName);
        },
        (error) => {
          console.error("Error getting location:", error);
          resolve("Location not available");
        }
      );
    });
  };

  // Helper function to get a readable location name from coordinates
  const getLocationNameFromCoordinates = (lat: number, lng: number): string => {
    // Rough location detection based on coordinates
    // This is a simplified fallback for when geocoding API is not available
    
    // India regions (based on common coordinates)
    if (lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97) {
      if (lat >= 12.8 && lat <= 13.2 && lng >= 77.4 && lng <= 77.8) {
        return "Bangalore, Karnataka";
      } else if (lat >= 28.5 && lat <= 28.8 && lng >= 77.0 && lng <= 77.3) {
        return "New Delhi, Delhi";
      } else if (lat >= 19.0 && lat <= 19.3 && lng >= 72.8 && lng <= 73.1) {
        return "Mumbai, Maharashtra";
      } else if (lat >= 22.5 && lat <= 22.7 && lng >= 88.3 && lng <= 88.5) {
        return "Kolkata, West Bengal";
      } else if (lat >= 12.9 && lat <= 13.1 && lng >= 80.2 && lng <= 80.3) {
        return "Chennai, Tamil Nadu";
      } else if (lat >= 17.3 && lat <= 17.5 && lng >= 78.4 && lng <= 78.6) {
        return "Hyderabad, Telangana";
      } else if (lat >= 26.8 && lat <= 27.2 && lng >= 80.9 && lng <= 81.3) {
        return "Lucknow, Uttar Pradesh";
      } else if (lat >= 23.0 && lat <= 23.3 && lng >= 72.5 && lng <= 72.7) {
        return "Ahmedabad, Gujarat";
      } else if (lat >= 18.5 && lat <= 18.6 && lng >= 73.8 && lng <= 73.9) {
        return "Pune, Maharashtra";
      } else if (lat >= 25.5 && lat <= 25.7 && lng >= 85.1 && lng <= 85.3) {
        return "Patna, Bihar";
      }
      return "India";
    }
    
    // US regions
    if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
      if (lat >= 40.5 && lat <= 40.8 && lng >= -74.0 && lng <= -73.8) {
        return "New York, USA";
      } else if (lat >= 34.0 && lat <= 34.2 && lng >= -118.3 && lng <= -118.1) {
        return "Los Angeles, USA";
      } else if (lat >= 41.8 && lat <= 42.0 && lng >= -87.7 && lng <= -87.5) {
        return "Chicago, USA";
      } else if (lat >= 29.7 && lat <= 29.8 && lng >= -95.4 && lng <= -95.3) {
        return "Houston, USA";
      } else if (lat >= 33.4 && lat <= 33.8 && lng >= -112.1 && lng <= -111.9) {
        return "Phoenix, USA";
      }
      return "United States";
    }
    
    // UK
    if (lat >= 49.9 && lat <= 60.9 && lng >= -8.0 && lng <= 1.8) {
      if (lat >= 51.5 && lat <= 51.6 && lng >= -0.2 && lng <= 0.0) {
        return "London, UK";
      }
      return "United Kingdom";
    }
    
    // Generic fallback with region info
    const hemisphere = lat >= 0 ? "Northern" : "Southern";
    const hemisphereLng = lng >= 0 ? "Eastern" : "Western";
    return `${hemisphere} Hemisphere, ${hemisphereLng} Hemisphere`;
  };

  // Handle progress submission
  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!validateProgressForm() || !selectedActivity) {
      return;
    }

    setSubmitting(true);

    try {
      console.log("Starting progress submission for activity:", selectedActivity);
      console.log("Form data:", progressFormData);
      console.log("Image selected:", !!selectedImage);

      // Get current user and location
      const currentUser = await getCurrentUser();
      const currentLocation = await getCurrentLocation();

      // Validate user is logged in
      if (!currentUser || !currentUser.id) {
        console.error("No authenticated user found");
        setError('You must be logged in to submit progress updates.');
        return;
      }

      // Prepare progress update data with correct schema
      const progressUpdateData = {
        activity_id: selectedActivity,
        progress: parseInt(progressFormData.progress_percent), // ✅ correct column name
        date: progressFormData.date,
        remarks: progressFormData.remarks.trim(),
        created_by: currentUser.id,
        location: currentLocation || progressFormData.location.trim(),
      };

      // DEBUG: Log before insert as requested
      console.log({
        activity_id: selectedActivity,
        progress: parseInt(progressFormData.progress_percent),
        date: progressFormData.date,
        created_by: currentUser.id
      });

      console.log("User ID for progress update:", currentUser.id);
      console.log("Inserting progress update with correct schema:", progressUpdateData);

      // Check if there's already a progress update for this activity and date
      const { data: existingUpdate, error: checkError } = await supabase
        .from("progress_updates")
        .select("id")
        .eq("activity_id", selectedActivity)
        .eq("date", progressFormData.date)
        .single();

      let data, error;
      
      if (checkError && checkError.code !== 'PGRST116') {
        // Real error occurred while checking
        console.error("Error checking existing progress update:", checkError);
        setError('Failed to check existing progress. Please try again.');
        return;
      }

      if (existingUpdate) {
        // Update existing progress update
        const result = await supabase
          .from("progress_updates")
          .update(progressUpdateData)
          .eq("id", existingUpdate.id)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
        console.log("Updated existing progress update:", data);
      } else {
        // Insert new progress update
        const result = await supabase
          .from("progress_updates")
          .insert(progressUpdateData)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
        console.log("Created new progress update:", data);
      }

      if (error) {
        console.error("Error saving progress update:", error);
        setError(`Failed to submit progress: ${error.message || "Please try again."}`);
        return;
      }

      console.log("Progress update created successfully:", data);
      showToast('Progress updated successfully');
      
      // Update activity dates based on progress
      const progress = parseInt(progressFormData.progress_percent);
      if (progress > 0) {
        await supabase
          .from("activities")
          .update({ actual_start: progressFormData.date })
          .eq("id", selectedActivity)
          .is("actual_start", null);
      }

      if (progress === 100) {
        await supabase
          .from("activities")
          .update({ actual_end: progressFormData.date })
          .eq("id", selectedActivity);
      } else {
        // Clear actual_end date when progress is less than 100%
        await supabase
          .from("activities")
          .update({ actual_end: null })
          .eq("id", selectedActivity);
      }
      
      // Reset form and close immediately
      setProgressFormData({
        date: new Date().toISOString().split('T')[0],
        progress_percent: "",
        remarks: "",
        created_by: "",
        location: "",
      });
      setShowProgressForm(false);
      setSelectedActivity("");
      
      // Clear image selection after form reset
      const imageToUpload = selectedImage;
      clearImageSelection();
      
      // Update only the specific activity that was updated
      const { data: updatedActivity, error: updateError } = await supabase
        .from("activities")
        .select("id, project_id, zone_id, activity_name, planned_start, planned_end, duration_days, status, created_at, updated_at, actual_start, actual_end")
        .eq("id", selectedActivity)
        .single();
      
      if (!updateError && updatedActivity) {
        // Update the specific activity in the activities array
        setActivities(prev => prev.map(activity => 
          activity.id === selectedActivity 
            ? { ...activity, ...updatedActivity, latest_progress: data }
            : activity
        ));
      }
      
      // Upload image in background if selected
      if (imageToUpload && data) {
        console.log("Uploading image in background...");
        uploadImageInBackground(imageToUpload, selectedActivity, data.id);
      }
      
    } catch (err) {
      console.error("Exception creating progress update:", err);
      console.error("Exception details:", JSON.stringify(err, null, 2));
      alert("An unexpected error occurred while creating the progress update.");
    } finally {
      setSubmitting(false);
    }
  };

  // Upload image in background and update progress record
  const uploadImageInBackground = async (file: File, activityId: string, progressUpdateId: string) => {
    try {
      const imageUrl = await uploadImage(file, activityId);
      
      if (imageUrl) {
        console.log("Background image upload successful, updating record:", imageUrl);
        
        // Update the progress record with image URL
        const { error: updateError } = await supabase
          .from("progress_updates")
          .update({ image_url: imageUrl })
          .eq("id", progressUpdateId);
          
        if (updateError) {
          console.error("Error updating image URL:", updateError);
        } else {
          console.log("Image URL updated successfully");
          // Refresh activities list to show the image
          fetchActivities();
        }
      } else {
        console.error("Background image upload failed");
      }
    } catch (err) {
      console.error("Exception in background image upload:", err);
    }
  };

  // Handle update progress button click
  const handleUpdateProgress = async (activityId: string) => {
    setError(null);
    setSelectedActivity(activityId);
    
    // Fetch latest progress for this activity
    try {
      const latestProgress = activities.find(a => a.id === activityId)?.latest_progress;
      const progressValue = latestProgress?.progress ?? 0;

      // Update form data with current progress
      const updatedFormData = {
        ...progressFormData,
        progress_percent: String(progressValue)
      };
      
      setProgressFormData(updatedFormData);
      
      // Store initial form data for change detection using the updated data
      setInitialProgressFormData(updatedFormData);
      setHasFormChanges(false);
      
    } catch (err) {
      console.error("Exception fetching latest progress:", err);
      // Default to 0% if exception
      const defaultFormData = {
        ...progressFormData,
        progress_percent: "0"
      };
      
      setProgressFormData(defaultFormData);
      setInitialProgressFormData(defaultFormData);
      setHasFormChanges(false);
    }
    
    setShowProgressForm(true);
  };

  // Handle view updates button click
  const handleViewUpdates = async (activityId: string) => {
    setSelectedActivityForUpdates(activityId);
    setShowUpdatesModal(true);
    
    // Fetch all progress updates for this activity
    setLoadingUpdates(true);
    try {
      const { data, error } = await supabase
        .from("progress_updates")
        .select("*")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching progress updates:", error);
      } else if (data && data.length > 0) {
        // Extract unique created_by IDs from progress updates
        const userIds = [...new Set(data.map(update => update.created_by).filter(Boolean))];
        
        if (userIds.length > 0) {
          try {
            // Fetch users from users table using those IDs
            const { data: users, error: usersError } = await supabase
              .from("users")
              .select("id, user_name, email")
              .in("id", userIds);
            
            if (usersError) {
              console.error("Error fetching users:", usersError);
              // Still set progress updates even if user fetch fails
              setAllProgressUpdates(data);
            } else {
              // Create user lookup map
              const userMap = new Map();
              users?.forEach(user => {
                userMap.set(user.id, user);
              });
              
              // Map user data to progress updates
              const updatesWithUsers = data.map(update => ({
                ...update,
                user: userMap.get(update.created_by)
              }));
              
              setAllProgressUpdates(updatesWithUsers);
            }
          } catch (userErr) {
            console.error("Exception fetching users:", userErr);
            // Still set progress updates even if user fetch fails
            setAllProgressUpdates(data);
          }
        } else {
          // No user IDs to fetch
          setAllProgressUpdates(data);
        }
      } else {
        setAllProgressUpdates([]);
      }
    } catch (err) {
      console.error("Exception fetching progress updates:", err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  // Handle edit activity button click
  const handleEditActivity = (activity: Activity) => {
    setSelectedActivityForEdit(activity);
    setShowEditActivityForm(true);
  };

  // Handle delete activity button click
  const handleDeleteActivity = (activity: Activity) => {
    // Backend validation: Block delete for non-super admin roles
    if (userData.role !== "super_admin") {
      alert("You don't have permission to delete activities.");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the activity "${activity.activity_name}"? This action cannot be undone.`)) {
      deleteActivity(activity.id);
    }
  };

  // Delete activity function
  const deleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) {
        console.error('Error deleting activity:', error);
        alert('Error deleting activity: ' + error.message);
      } else {
        alert('Activity deleted successfully!');
        await fetchActivities(); // Refresh the activities list
      }
    } catch (err) {
      console.error('Exception deleting activity:', err);
      alert('An unexpected error occurred while deleting the activity.');
    }
  };

  // Handle edit activity form submission
  const handleEditActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedActivityForEdit) return;

    try {
      const updateData = {
        activity_name: selectedActivityForEdit.activity_name.trim(),
        planned_start: selectedActivityForEdit.planned_start,
        planned_end: selectedActivityForEdit.planned_end,
        duration_days: parseInt(selectedActivityForEdit.duration_days?.toString() || '0') || null,
        constraint_status: selectedActivityForEdit.constraint_status || null,
        task_id: selectedActivityForEdit.task_id || null,
      };

      const { error } = await supabase
        .from('activities')
        .update(updateData)
        .eq('id', selectedActivityForEdit.id);

      if (error) {
        console.error('Error updating activity:', error);
        alert('Error updating activity: ' + error.message);
      } else {
        alert('Activity updated successfully!');
        setShowEditActivityForm(false);
        setSelectedActivityForEdit(null);
        await fetchActivities(); // Refresh the activities list
      }
    } catch (err) {
      console.error('Exception updating activity:', err);
      alert('An unexpected error occurred while updating the activity.');
    }
  };

  // Get latest progress image for preview
  const getLatestProgressImage = (activityId: string | null): string => {
    if (!activityId) return '';
    const activity = activities.find(a => a.id === activityId);
    return activity?.latest_progress?.image_url ?? '';
  };

  
  // Calculate delay in days with proper logic for completed vs incomplete
  const calculateDelay = (plannedEnd: string, progressPercent: number, actualEndDate?: string) => {
    const endDate = new Date(plannedEnd);
    
    if (progressPercent === 100) {
      // Completed: compare actual end date vs planned end date
      const actualEnd = actualEndDate ? new Date(actualEndDate) : new Date();
      if (actualEnd <= endDate) return null; // On time or early
      
      const diffTime = actualEnd.getTime() - endDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      // Not completed: compare today vs planned end date
      const today = new Date();
      if (today <= endDate) return null; // On time
      
      const diffTime = today.getTime() - endDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  };

  // Get enhanced status with delay consideration
  const getEnhancedStatus = (progressPercent: number, plannedEnd: string, actualEndDate?: string) => {
    const delay = calculateDelay(plannedEnd, progressPercent, actualEndDate);
    
    if (progressPercent === 0) return { status: "Pending", delayed: false, delay: null };
    if (progressPercent === 100) return { status: "Completed", delayed: !!delay, delay };
    
    // In progress - check if delayed
    return { 
      status: "Active", 
      delayed: !!delay, 
      delay 
    };
  };

  // Get status color with delay consideration
  const getEnhancedStatusColor = (progressPercent: number, plannedEnd: string, actualEndDate?: string) => {
    const { status, delayed } = getEnhancedStatus(progressPercent, plannedEnd, actualEndDate);
    
    if (delayed) {
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"; // Delayed
    }
    
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"; // Green
      case "in_progress":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300"; // Orange
      case "not_started":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"; // Grey
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"; // Red
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  // Format delay text
  const formatDelayText = (days: number) => {
    if (days === 1) return "1 day delay";
    return `${days} days delay`;
  };

  // Compress image function
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
          
            // Calculate new dimensions (max width 1280px)
            let { width, height } = img;
            if (width > 1280) {
              height = (height * 1280) / width;
              width = 1280;
            }
            
            canvas.width = width;
            canvas.height = height;
          
            // Draw and compress
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                resolve(blob!);
              },
              'image/jpeg',
              0.7
            );
          }
        };
      };
    });
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file: File, activityId: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      // Compress image
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      
      // Generate file path with timestamp to avoid conflicts
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = `${activityId}/${timestamp}.jpg`;
      
      console.log("Uploading image to path:", filePath);
      console.log("File size:", compressedFile.size, "bytes");
      
      // Upload to Supabase Storage using proper API
      const { data, error } = await supabase.storage
        .from('progress-images')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.error("Supabase storage upload error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return null;
      }
      
      console.log("Upload successful:", data);
      
      // Get public URL using proper API
      const { data: publicUrlData } = supabase.storage
        .from('progress-images')
        .getPublicUrl(filePath);
      
      if (!publicUrlData || !publicUrlData.publicUrl) {
        console.error("Failed to get public URL");
        return null;
      }
      
      console.log("Public URL generated:", publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
      
    } catch (err) {
      console.error("Exception uploading image:", err);
      console.error("Exception details:", JSON.stringify(err, null, 2));
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG/PNG)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear image selection
const clearImageSelection = () => {
  setSelectedImage(null);
  setImagePreview("");
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Delayed":
      return "bg-red-100 text-red-800";
    case "Yet to Start":
      return "bg-gray-100 text-gray-800";
    case "On Hold":
      return "bg-yellow-100 text-yellow-800";
    case "Cancelled":
      return "bg-red-200 text-red-900";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusDotColor = (
  progressPercent: number,
  plannedEnd: string,
  actualEndDate?: string
) => {
  const { delayed } = getEnhancedStatus(progressPercent, plannedEnd, actualEndDate);

  if (delayed) return "bg-red-500";
  if (progressPercent === 100) return "bg-green-500";
  if (progressPercent > 0) return "bg-blue-500";
  return "bg-gray-400";
};

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Activities
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track and manage project activities with real-time progress updates
              </p>
              {userData && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {userData.role?.charAt(0).toUpperCase() + userData.role?.slice(1).replace('_', ' ')} : {userData.email}
                </p>
              )}
            </div>
            <div className="flex space-x-4">
              {userData?.role === 'org_admin' ? (
                <>
                  <button
                    onClick={() => router.push('/org-admin')}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Back to Organization Dashboard
                  </button>
                  <button
                    onClick={() => router.push('/org-admin/projects')}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Projects
                  </button>
                </>
              ) : userData?.role === 'super_admin' ? (
                <>
                  <button
                    onClick={() => router.push('/super-admin')}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Back to Super Admin Dashboard
                  </button>
                  <button
                    onClick={() => router.push('/super-admin/organizations')}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Organizations
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push('/user-dashboard')}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Back to User Dashboard
                </button>
              )}
              {canCreateActivity && (
                <button
                  onClick={() => setShowActivityForm(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Add Activity
                </button>
              )}
            </div>
          </div>

          {/* Zone Selector */}
          <div className="mb-6">
            <label htmlFor="zone-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Zone
            </label>
            <select
              id="zone-select"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select a zone...</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.zone_name}
                </option>
              ))}
            </select>
          </div>

          {/* Delayed Activities Warning Banner */}
          {getStatistics().delayedActivities > 0 && (
            <div 
              className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => {
                // Scroll to first delayed activity
                const delayedActivities = activities.filter(activity => {
                  const plannedEnd = new Date(activity.planned_end);
                  const progress = activity.latest_progress?.progress || 0;
                  return progress < 100 && new Date() > plannedEnd;
                });
                
                if (delayedActivities.length > 0 && typeof document !== 'undefined') {
                  const firstDelayedId = `activity-${delayedActivities[0].id}`;
                  const element = document.getElementById(firstDelayedId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight effect
                    element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                    setTimeout(() => {
                      element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                    }, 3000);
                  }
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <div className="text-red-800 dark:text-red-200 font-semibold">
                      {getStatistics().delayedActivities} {getStatistics().delayedActivities === 1 ? 'activity' : 'activities'} delayed
                    </div>
                    <div className="text-red-600 dark:text-red-300 text-sm">
                      Click to scroll to delayed activities
                    </div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* TOP: Health Score & Statistics */}
          {activities.length > 0 && (
            <div className="mt-8 space-y-6">
              {/* Health Score Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className={`text-4xl font-bold ${getStatistics().scoreColor}`}>
                      Health Score: {getStatistics().healthScore}%
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-2">
                      {getStatistics().statusMessage}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Score Formula: (Completed × 60%) + (In Progress × 30%) - (Delayed × 40%)
                    </div>
                  </div>
                </div>
                
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {getStatistics().totalActivities}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">Total Activities</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {getStatistics().totalActivities - getStatistics().delayedActivities}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">On Time</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {getStatistics().delayedActivities}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">Delayed</div>
                  </div>
                </div>
              </div>

              {/* MIDDLE: Charts Side-by-Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Activity Status Distribution
                  </h3>
                  <div className="flex justify-center">
                    {renderPieChart()}
                  </div>
                  <div className="mt-4 space-y-2">
                    {getPieChartData().map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: item.color }}
                          ></div>
                          <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Top 10 Activities by Progress
                  </h3>
                  <div className="h-64">
                    {renderBarChart()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM: Activities List Header */}
          {!loading && activities.length > 0 && (
            <div className="mt-8 mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activities</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Manage and track project activities
              </p>
            </div>
          )}

          {/* Activities List */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activities.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2M9 5a2 2 0 012 2m0 0V5a2 2 0 012-2m-4 0v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No Activities Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Select a zone and add your first activity
                    </p>
                    {canCreateActivity && (
                      <button
                        onClick={() => setShowActivityForm(true)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Add Your First Activity
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                sortActivities(activities).map((activity) => {
                  const delayed = isActivityDelayed(activity);
                  return (
                    <div
                      key={activity.id}
                      id={`activity-${activity.id}`}
                      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ${
                        delayed ? 'border-2 border-red-500' : ''
                      }`}
                    >
                    <div className="p-6">
                      {/* Activity Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-2">
                          {/* Status Dot */}
                          <div className={`w-3 h-3 rounded-full ${getStatusDotColor(activity.latest_progress?.progress || 0, activity.planned_end, activity.latest_progress?.created_at)}`}></div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {activity.activity_name}
                          </h3>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getActivityStatus({
                          progress: activity.latest_progress?.progress || 0,
                          planned_start: activity.planned_start,
                          planned_end: activity.planned_end,
                          actual_end: activity.latest_progress?.created_at,
                          constraint_status: activity.constraint_status
                        }))}`}>
                          {getActivityStatus({
                            progress: activity.latest_progress?.progress || 0,
                            planned_start: activity.planned_start,
                            planned_end: activity.planned_end,
                            actual_end: activity.latest_progress?.created_at,
                            constraint_status: activity.constraint_status
                          }).toUpperCase()}
                        </span>
                      </div>

                      {/* Activity Details */}
                      <div className="space-y-3">
                        {/* WBS Information */}
                        {activity.task && (
                          <div className="border-l-2 border-purple-500 pl-3">
                            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">WBS</p>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span className="text-sm">
                                {activity.task.wbs_code} - {activity.task.task_name}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Quantity Information */}
                        {activity.quantity && activity.unit && (
                          <div className="border-l-2 border-orange-500 pl-3">
                            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Quantity</p>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                              </svg>
                              <span className="text-sm">
                                {activity.quantity} {activity.unit}
                                {activity.boq_rate && ` @ $${activity.boq_rate}/unit`}
                                {activity.boq_rate && activity.quantity && (
                                  <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                                    Total: ${(activity.quantity * activity.boq_rate).toLocaleString()}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Planned Dates */}
                        <div className="border-l-2 border-blue-500 pl-3">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Planned</p>
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm">
                              {activity.planned_start && activity.planned_end
                                ? `${formatDate(activity.planned_start)} - ${formatDate(activity.planned_end)}`
                                : activity.planned_start
                                ? `Start: ${formatDate(activity.planned_start)}`
                                : activity.planned_end
                                ? `End: ${formatDate(activity.planned_end)}`
                                : "Not set"}
                            </span>
                          </div>
                        </div>

                        {/* Actual Dates */}
                        <div className="border-l-2 border-green-500 pl-3">
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Actual</p>
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm">
                              {getActualDateDisplay(activity)}
                            </span>
                          </div>
                        </div>

                        {/* Delay Warning */}
                        {activity.actual_end && (
                          <div className="border-l-2 border-red-500 pl-3">
                            <div className="flex items-center text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className={`text-sm font-medium ${getDelayDays(activity.planned_end, activity.actual_end) === 0 ? 'text-green-600' : ''}`}>
                                Delay: {getDelayDays(activity.planned_end, activity.actual_end)} days{getDelayDays(activity.planned_end, activity.actual_end) === 0 ? ' | On-Time' : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {activity.duration_days && (
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3v-4m0 4v4m0-4v-4m6 6H6a2 2 0 01-2-2v-8a2 2 0 012 2h12a2 2 0 012 2v8a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm">
                              Duration: {activity.duration_days} days
                            </span>
                          </div>
                        )}

                        {/* Progress Display with Visual Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <span className="text-sm font-medium">
                                Progress: {(() => {
                                  const latestProgress = activities.find(a => a.id === activity.id)?.latest_progress;
                                  return latestProgress ? `${latestProgress.progress}%` : '0%';
                                })()}
                              </span>
                            </div>
                            {activity.latest_progress && (
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                {formatDate(activity.latest_progress.created_at)}
                              </span>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                (() => {
                                  const latestProgress = activities.find(a => a.id === activity.id)?.latest_progress;
                                  const progress = latestProgress?.progress || 0;
                                  return progress === 100 
                                    ? 'bg-green-500' 
                                    : progress > 0 
                                      ? 'bg-blue-500' 
                                      : 'bg-gray-400';
                                })()
                              }`}
                              style={{ 
                                width: `${(() => {
                                  const latestProgress = activities.find(a => a.id === activity.id)?.latest_progress;
                                  return latestProgress?.progress || 0;
                                })()}%` 
                              }}
                            ></div>
                          </div>
                          
                          {/* Progress Status Text */}
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(() => {
                              const latestProgress = activities.find(a => a.id === activity.id)?.latest_progress;
                              const progress = latestProgress?.progress || 0;
                              if (progress === 0) return 'Not started';
                              if (progress === 100) return 'Completed';
                              return `${progress}% complete`;
                            })()}
                          </div>
                        </div>

                        {/* Latest Progress Image */}
                        {activity.latest_progress?.image_url && (
                          <div className="mt-3">
                            <img 
                              src={activity.latest_progress.image_url} 
                              alt="Latest progress" 
                              style={{
                                width: '100%', 
                                maxHeight: '200px', 
                                objectFit: 'cover', 
                                borderRadius: '8px'
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateProgress(activity.id)}
                          disabled={submitting}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Submitting...' : 'Update Progress'}
                        </button>
                        <button
                          onClick={() => handleViewUpdates(activity.id)}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md"
                        >
                          View Updates
                        </button>
                        {(userRole === 'super_admin' || userRole === 'org_admin') && (
                        <>
                          <button
                            onClick={() => handleEditActivity(activity)}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md"
                          >
                            Edit Activity
                          </button>
                          <button
                            onClick={() => handleDeleteActivity(activity)}
                            className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow hover:shadow-md"
                          >
                            Delete Activity
                          </button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}

          {/* Activity Form Modal */}
          {showActivityForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowActivityForm(false)}
            >
              <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Create New Activity
                  </h2>
                  <button
                    onClick={() => setShowActivityForm(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleActivitySubmit} className="space-y-6">
                  {/* Activity Name */}
                  <div>
                    <label htmlFor="activity-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      id="activity-name"
                      name="activity_name"
                      value={formData.activity_name}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.activity_name
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      placeholder="Enter activity name"
                      disabled={submitting}
                    />
                    {errors.activity_name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.activity_name}
                      </p>
                    )}
                  </div>

                  {/* WBS Selection */}
                  <div>
                    <label htmlFor="task-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WBS Task (Optional)
                    </label>
                    <select
                      id="task-id"
                      name="task_id"
                      value={formData.task_id || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      disabled={submitting}
                    >
                      <option value="">Select WBS task (optional)</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {'  '.repeat(task.level || 0)}{task.wbs_code} - {task.task_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Start Date */}
                    <div>
                      <label htmlFor="planned-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        id="planned-start"
                        name="planned_start"
                        value={formData.planned_start}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.planned_start
                            ? "border-red-300 dark:border-red-600"
                            : "border-gray-300 dark:border-gray-600"
                        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                        disabled={submitting}
                      />
                      {errors.planned_start && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.planned_start}
                        </p>
                      )}
                    </div>

                    {/* End Date */}
                    <div>
                      <label htmlFor="planned-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        id="planned-end"
                        name="planned_end"
                        value={formData.planned_end}
                        min={formData.planned_start}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 rounded-lg border ${
                          errors.planned_end
                            ? "border-red-300 dark:border-red-600"
                            : "border-gray-300 dark:border-gray-600"
                        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                        disabled={submitting}
                      />
                      {errors.planned_end && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.planned_end}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Duration and Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Duration */}
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Duration (days)
                      </label>
                      <input
                        type="number"
                        id="duration"
                        name="duration_days"
                        value={formData.duration_days}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Enter duration"
                        disabled={submitting}
                      />
                    </div>

                    {/* Constraint Status */}
                    <div>
                      <label htmlFor="constraint_status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Constraint Status (Optional)
                      </label>
                      <select
                        id="constraint_status"
                        name="constraint_status"
                        value={formData.constraint_status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        disabled={submitting}
                      >
                        <option value="">Select</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowActivityForm(false)}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    {(userData.role === 'super_admin' || userData.role === 'org_admin') && (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating...
                          </span>
                        ) : (
                          "Create Activity"
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Progress Update Form Modal */}
          {showProgressForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => {
                if (hasFormChanges) {
                  if (typeof window !== 'undefined' && window.confirm("You have unsaved changes. Are you sure you want to exit?")) {
                    setShowProgressForm(false);
                    setSelectedActivity("");
                    setProgressErrors({});
                    setError(null);
                    clearImageSelection();
                    setHasFormChanges(false);
                  }
                } else {
                  setShowProgressForm(false);
                  setSelectedActivity("");
                  setProgressErrors({});
                  setError(null);
                  clearImageSelection();
                  setHasFormChanges(false);
                }
              }}
            >
              <div 
                className="modal-container bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Update Progress
                  </h2>
                  <button
                    onClick={() => {
                      setShowProgressForm(false);
                      setSelectedActivity("");
                      setProgressErrors({});
                      setError(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Latest Progress Image Preview */}
                {getLatestProgressImage(selectedActivity) && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Latest Progress Image
                    </p>
                    <img 
                      src={getLatestProgressImage(selectedActivity)} 
                      alt="Latest progress" 
                      className="progress-image-preview rounded-lg border border-gray-300 dark:border-gray-600 max-h-[300px] w-full object-contain"
                    />
                  </div>
                )}

                <form id="progress-form" onSubmit={handleProgressSubmit} className="space-y-6 flex-1 overflow-y-auto">
                  {error && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-300">
                      {error}
                    </div>
                  )}
                  {/* Date */}
                  <div>
                    <label htmlFor="progress-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      id="progress-date"
                      name="date"
                      value={progressFormData.date}
                      onChange={handleProgressInputChange}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        progressErrors.date
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      disabled={submitting}
                    />
                    {progressErrors.date && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {progressErrors.date}
                      </p>
                    )}
                  </div>

                  {/* Progress Percentage */}
                  <div>
                    <label htmlFor="progress-percent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Progress (%) *
                    </label>
                    <input
                      type="number"
                      id="progress-percent"
                      name="progress_percent"
                      value={progressFormData.progress_percent}
                      onChange={handleProgressInputChange}
                      min="0"
                      max="100"
                      className={`w-full px-4 py-3 rounded-lg border ${
                        progressErrors.progress_percent
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      placeholder="Enter progress percentage (0-100)"
                      disabled={submitting}
                    />
                    {progressErrors.progress_percent && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {progressErrors.progress_percent}
                      </p>
                    )}
                  </div>

                  {/* Constraint Status */}
                  <div>
                    <label htmlFor="constraint-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Constraint Status (Optional)
                    </label>
                    <select
                      id="constraint-status"
                      value={constraintStatus || ""}
                      onChange={(e) => setConstraintStatus(e.target.value || null)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      disabled={submitting}
                    >
                      <option value="">No Change</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label htmlFor="progress-remarks" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Remarks
                    </label>
                    <textarea
                      id="progress-remarks"
                      name="remarks"
                      value={progressFormData.remarks}
                      onChange={handleProgressInputChange}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Add any notes or remarks about this progress update..."
                      disabled={submitting}
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Progress Image (Optional)
                    </label>
                    
                    {!imagePreview ? (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                        <div className="text-center">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <div className="mt-2">
                            <label htmlFor="progress-image" className="cursor-pointer">
                              <span className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                Click to upload image
                              </span>
                              <input
                                id="progress-image"
                                type="file"
                                className="sr-only"
                                accept="image/jpeg,image/png"
                                onChange={handleImageSelect}
                                disabled={uploadingImage}
                              />
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              JPG/PNG up to 10MB (will be compressed)
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Progress preview"
                          className="progress-image-preview rounded-lg border border-gray-300 dark:border-gray-600 max-h-[300px] w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={clearImageSelection}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg"
                          disabled={uploadingImage}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                            <div className="text-white text-sm">Uploading...</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700 mt-auto sticky bottom-0 bg-white dark:bg-gray-800 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProgressForm(false);
                        setSelectedActivity("");
                        setProgressErrors({});
                        setError(null);
                      }}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </span>
                      ) : (
                        "Update Progress"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Progress Updates List Modal */}
          {showUpdatesModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => {
                setShowUpdatesModal(false);
                setSelectedActivityForUpdates("");
                setAllProgressUpdates([]);
              }}
            >
              <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Progress Updates
                  </h2>
                  <button
                    onClick={() => {
                      setShowUpdatesModal(false);
                      setSelectedActivityForUpdates("");
                      setAllProgressUpdates([]);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {loadingUpdates ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  </div>
                ) : allProgressUpdates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No Progress Updates Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      This activity doesn't have any progress updates yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[60vh]">
                    {/* Timeline Container */}
                    <div className="relative">
                      {/* Timeline Line */}
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                      
                      {/* Timeline Items */}
                      {allProgressUpdates.map((update, index) => (
                        <div key={update.id} className="relative flex items-start mb-8 last:mb-0">
                          {/* Left Side - Timeline */}
                          <div className="flex flex-col items-center mr-6 relative z-10">
                            {/* Timeline Dot */}
                            <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-md"></div>
                            {/* Date */}
                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2 text-center whitespace-nowrap">
                              {formatDateTimeIST(update.created_at)}
                            </div>
                          </div>
                          
                          {/* Right Side - Content Card */}
                          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                            {/* Progress Percentage */}
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                              {update.progress}%
                            </div>
                            
                            {/* Updated By */}
                            {(update.created_by || update.user) && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span className="font-medium">Updated by:</span> {update.user?.name || update.user?.email || update.created_by}
                              </div>
                            )}
                            
                            {/* Location */}
                            {update.location && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                <span className="font-medium">Location:</span> {update.location}
                              </div>
                            )}
                            
                            {/* Remarks */}
                            {update.remarks && (
                              <div className="text-gray-700 dark:text-gray-300 text-sm mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                                {update.remarks}
                              </div>
                            )}
                            
                            {/* Image */}
                            {update.image_url && (
                              <div className="mt-4">
                                <img 
                                  src={update.image_url} 
                                  alt="Progress update" 
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer transition-transform hover:scale-105"
                                  style={{ maxHeight: '200px', objectFit: 'cover' }}
                                  onClick={() => {
                                    // Optional: Add image expansion logic here
                                    if (typeof window !== 'undefined') {
                                      window.open(update.image_url, '_blank');
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

          {/* Edit Activity Modal */}
          {showEditActivityForm && selectedActivityForEdit && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => {
                setShowEditActivityForm(false);
                setSelectedActivityForEdit(null);
              }}
            >
              <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Edit Activity
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditActivityForm(false);
                      setSelectedActivityForEdit(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleEditActivitySubmit} className="space-y-6">
                  {/* Activity Name */}
                  <div>
                    <label htmlFor="edit-activity-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      id="edit-activity-name"
                      name="activity_name"
                      value={selectedActivityForEdit.activity_name}
                      onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, activity_name: e.target.value})}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter activity name"
                      required
                    />
                  </div>

                  {/* WBS Task Selection */}
                  <div>
                    <label htmlFor="edit-task-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WBS Task (Optional)
                    </label>
                    <select
                      id="edit-task-id"
                      name="task_id"
                      value={selectedActivityForEdit.task_id || ''}
                      onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, task_id: e.target.value})}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Select WBS task (optional)</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {'  '.repeat(task.level || 0)}{task.wbs_code} - {task.task_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        id="edit-start-date"
                        name="planned_start"
                        value={selectedActivityForEdit.planned_start}
                        onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, planned_start: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        id="edit-end-date"
                        name="planned_end"
                        value={selectedActivityForEdit.planned_end}
                        onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, planned_end: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label htmlFor="edit-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration (days)
                    </label>
                    <input
                      type="number"
                      id="edit-duration"
                      name="duration_days"
                      value={selectedActivityForEdit.duration_days?.toString() || ''}
                      onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, duration_days: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Enter duration"
                      min="1"
                    />
                  </div>

                  {/* Constraint Status */}
                  <div>
                    <label htmlFor="edit-constraint-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Constraint Status (Optional)
                    </label>
                    <select
                      id="edit-constraint-status"
                      value={selectedActivityForEdit.constraint_status || ""}
                      onChange={(e) => setSelectedActivityForEdit({...selectedActivityForEdit, constraint_status: e.target.value || undefined})}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Select</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditActivityForm(false);
                        setSelectedActivityForEdit(null);
                      }}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Update Activity
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}
      </div>
    </div>
  );
}
