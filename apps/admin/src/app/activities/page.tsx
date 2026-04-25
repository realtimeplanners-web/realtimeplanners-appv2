"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

interface Activity {
  id: string;
  project_id: string;
  name: string;
  planned_start: string;
  planned_end: string;
  zone_id: string;
  created_at: string;
  updated_at: string;
  latest_progress?: ProgressUpdate | null;
}

interface Zone {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}

interface ActivityFormData {
  name: string;
  planned_start: string;
  planned_end: string;
  duration_days: string;
  status: string;
}

interface ProgressUpdate {
  id: string;
  activity_id: string;
  date: string;
  progress_percent: number;
  remarks: string;
  updated_by: string;
  location: string;
  image_url?: string;
  created_at: string;
}

interface ActivityWithProgress extends Activity {
  latest_progress: ProgressUpdate | null;
}

interface ProgressFormData {
  date: string;
  progress_percent: string;
  remarks: string;
  updated_by: string;
  location: string;
  image_url?: string;
}

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activities, setActivities] = useState<ActivityWithProgress[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dark, setDark] = useState(false);

  // Set dynamic page title
  useEffect(() => {
    document.title = "Activities | RTP";
  }, [searchParams]); // Include searchParams to handle URL changes

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
    const progress = activity.latest_progress?.progress_percent || 0;
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
      const aProgress = a.latest_progress?.progress_percent || 0;
      const bProgress = b.latest_progress?.progress_percent || 0;
      return bProgress - aProgress;
    });
  };

  // Chart data calculation functions
  const getPieChartData = () => {
    const notStarted = activities.filter(a => !a.latest_progress || a.latest_progress.progress_percent === 0).length;
    const inProgress = activities.filter(a => a.latest_progress && a.latest_progress.progress_percent > 0 && a.latest_progress.progress_percent < 100).length;
    const completed = activities.filter(a => a.latest_progress && a.latest_progress.progress_percent === 100).length;

    return [
      { label: 'Not Started', value: notStarted, color: '#ef4444' },
      { label: 'In Progress', value: inProgress, color: '#f59e0b' },
      { label: 'Completed', value: completed, color: '#10b981' }
    ];
  };

  const getBarChartData = () => {
    return activities
      .map(activity => ({
        name: activity.name,
        progress: activity.latest_progress?.progress_percent || 0
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);
  };

  const getStatistics = () => {
    const today = new Date();
    const delayedActivities = activities.filter(activity => {
      const plannedEnd = new Date(activity.planned_end);
      const progress = activity.latest_progress?.progress_percent || 0;
      
      // Mark as delayed if progress < 100 AND today > planned_end
      return progress < 100 && today > plannedEnd;
    }).length;

    const totalActivities = activities.length;
    const completedActivities = activities.filter(a => a.latest_progress?.progress_percent === 100).length;
    const inProgressActivities = activities.filter(a => a.latest_progress && a.latest_progress.progress_percent > 0 && a.latest_progress.progress_percent < 100).length;
    const notStartedActivities = activities.filter(a => !a.latest_progress || a.latest_progress.progress_percent === 0).length;
    
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
      ? Math.round(activities.reduce((sum, activity) => sum + (activity.latest_progress?.progress_percent || 0), 0) / activities.length)
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
    name: "",
    planned_start: "",
    planned_end: "",
    duration_days: "",
    status: "pending",
  });

  const [progressFormData, setProgressFormData] = useState<ProgressFormData>({
    date: new Date().toISOString().split('T')[0],
    progress_percent: "",
    remarks: "",
    updated_by: "",
    location: "",
  });

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
        if (window.confirm("You have unsaved changes. Are you sure you want to exit?")) {
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
  }, [showProgressForm, showUpdatesModal, hasFormChanges]);

  // Handle enter key press for form submission
  const handleEnterKey = useCallback((e: KeyboardEvent) => {
    if (!showProgressForm || submitting) return;
    
    // Prevent default if not in textarea
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      // Trigger form submission
      const form = document.querySelector('#progress-form') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }
  }, [showProgressForm, submitting]);

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
  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from("zones")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching zones:", error);
      } else {
        setZones(data || []);
        if (data && data.length > 0 && !selectedZone) {
          setSelectedZone(data[0].id);
        }
      }
    } catch (err) {
      console.error("Exception fetching zones:", err);
    }
  };

  // Get zone ID from URL parameters
  const getZoneIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('zone_id') || '';
  };

  const zoneId = getZoneIdFromUrl();

  // Fetch activities with optimized queries
  const fetchActivities = async () => {
    if (!selectedZone) return;
    
    setLoading(true);
    try {
      // Fetch only essential activity fields (light query)
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("id, project_id, zone_id, name, planned_start, planned_end, duration_days, status, created_at")
        .eq("zone_id", selectedZone)
        .order("created_at", { ascending: false });

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

      // Set activities immediately without progress
      const activitiesWithoutProgress: ActivityWithProgress[] = activitiesData.map(activity => ({
        ...activity,
        latest_progress: null
      }));
      
      setActivities(activitiesWithoutProgress);
      
      // Fetch latest progress separately (light query)
      fetchLatestProgressForActivities(activitiesData);
      
    } catch (err) {
      console.error("Exception fetching activities:", err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest progress for activities (separate light query)
  const fetchLatestProgressForActivities = async (activities: any[]) => {
    try {
      const activityIds = activities.map(a => a.id);
      
      if (activityIds.length === 0) return;
      
      // Fetch only latest progress for each activity (light query)
      const { data: progressData, error: progressError } = await supabase
        .from("progress_updates")
        .select("id, activity_id, date, progress_percent, remarks, image_url")
        .in("activity_id", activityIds)
        .order("date", { ascending: false });

      if (progressError) {
        console.error("Error fetching progress updates:", progressError);
        return;
      }

      // Group progress by activity_id and get latest for each
      const latestProgressByActivity: { [key: string]: any } = {};
      
      (progressData || []).forEach(progress => {
        if (!latestProgressByActivity[progress.activity_id]) {
          latestProgressByActivity[progress.activity_id] = progress;
        }
      });

      // Update activities with latest progress
      const activitiesWithProgress = activities.map(activity => ({
        ...activity,
        latest_progress: latestProgressByActivity[activity.id] || null
      }));

      setActivities(activitiesWithProgress);
      
    } catch (err) {
      console.error("Exception fetching latest progress:", err);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [selectedZone]);

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

    if (!formData.name.trim()) {
      newErrors.name = "Activity name is required";
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
    
    if (!validateActivityForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Insert activity into Supabase
      const { data, error } = await supabase
        .from("activities")
        .insert({
          name: formData.name.trim(),
          planned_start: formData.planned_start,
          planned_end: formData.planned_end,
          duration_days: parseInt(formData.duration_days) || 0,
          status: formData.status,
          project_id: zones.find(z => z.id === selectedZone)?.project_id || "",
          zone_id: selectedZone,
          company_id: 1, // Fixed company_id as requested
        })
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
          name: "",
          planned_start: "",
          planned_end: "",
          duration_days: "",
          status: "pending",
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
        console.log("Geolocation is not supported by this browser");
        resolve("Location not available");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("Got coordinates:", latitude, longitude);

          try {
            // Try OpenCage Geocoding API first
            const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY || "YOUR_OPENCAGE_API_KEY";
            
            // Only attempt API call if we have a real API key
            if (apiKey && apiKey !== "YOUR_OPENCAGE_API_KEY") {
              const response = await fetch(
                `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}&limit=1`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                  const result = data.results[0];
                  // Try to get a meaningful location name
                  const locationParts = [];
                  if (result.components.city) locationParts.push(result.components.city);
                  if (result.components.town) locationParts.push(result.components.town);
                  if (result.components.village) locationParts.push(result.components.village);
                  if (result.components.county) locationParts.push(result.components.county);
                  if (result.components.state) locationParts.push(result.components.state);
                  
                  const locationName = locationParts.length > 0 
                    ? locationParts.join(", ")
                    : result.formatted;
                  
                  console.log("Got address:", locationName);
                  resolve(locationName);
                  return;
                }
              }
            }
          } catch (error) {
            console.error("Error getting address from geocoding API:", error);
          }

          // Fallback to a more readable location based on coordinates
          const locationName = getLocationNameFromCoordinates(latitude, longitude);
          console.log("Using fallback location:", locationName);
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

      // Prepare progress update data (without image initially)
      const progressUpdateData = {
        activity_id: selectedActivity,
        date: progressFormData.date,
        progress_percent: parseInt(progressFormData.progress_percent),
        remarks: progressFormData.remarks.trim(),
        updated_by: currentUser?.email || currentUser?.id || progressFormData.updated_by.trim(),
        location: currentLocation || progressFormData.location.trim(),
        image_url: null, // Will be updated later
      };

      console.log("Inserting progress update:", progressUpdateData);

      // Insert progress update into Supabase immediately
      const { data, error } = await supabase
        .from("progress_updates")
        .insert(progressUpdateData)
        .select()
        .single();

      if (error) {
        console.error("Error creating progress update:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        setError('Failed to submit progress. Please try again.');
        return;
      }

      console.log("Progress update created successfully:", data);
      showToast('Progress updated successfully');
      
      // Reset form and close immediately
      setProgressFormData({
        date: new Date().toISOString().split('T')[0],
        progress_percent: "",
        remarks: "",
        updated_by: "",
        location: "",
      });
      setShowProgressForm(false);
      setSelectedActivity("");
      
      // Clear image selection after form reset
      const imageToUpload = selectedImage;
      clearImageSelection();
      
      // Refresh activities list immediately
      fetchActivities();
      
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
    setSelectedActivity(activityId);
    
    // Fetch latest progress for this activity
    try {
      const { data: progressData, error } = await supabase
        .from("progress_updates")
        .select("*")
        .eq("activity_id", activityId)
        .order("date", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching latest progress:", error);
        // Default to 0% if error
        setProgressFormData(prev => ({
          ...prev,
          progress_percent: "0"
        }));
      } else if (progressData && progressData.length > 0) {
        // Pre-fill with latest progress
        setProgressFormData(prev => ({
          ...prev,
          progress_percent: progressData[0].progress_percent.toString()
        }));
      } else {
        // Default to 0% if no progress exists
        setProgressFormData(prev => ({
          ...prev,
          progress_percent: "0"
        }));
      }
    } catch (err) {
      console.error("Exception fetching latest progress:", err);
      // Default to 0% if exception
      setProgressFormData(prev => ({
        ...prev,
        progress_percent: "0"
      }));
    }
    
    // Store initial form data for change detection
    const initialData = { ...progressFormData };
    setInitialProgressFormData(initialData);
    setHasFormChanges(false);
    
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
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching progress updates:", error);
      } else {
        setAllProgressUpdates(data || []);
      }
    } catch (err) {
      console.error("Exception fetching progress updates:", err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  // Get latest progress image for preview
  const getLatestProgressImage = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.latest_progress?.image_url || null;
  };

  // Calculate automatic status based on progress
  const getAutomaticStatus = (progressPercent: number) => {
    if (progressPercent === 0) return "not_started";
    if (progressPercent > 0 && progressPercent < 100) return "in_progress";
    if (progressPercent === 100) return "completed";
    return "pending";
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
    
    if (progressPercent === 0) return { status: "not_started", delayed: false, delay: null };
    if (progressPercent === 100) return { status: "completed", delayed: !!delay, delay };
    
    // In progress - check if delayed
    return { 
      status: "in_progress", 
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
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  // Get status dot color
  const getStatusDotColor = (progressPercent: number, plannedEnd: string, actualEndDate?: string) => {
    const { status, delayed } = getEnhancedStatus(progressPercent, plannedEnd, actualEndDate);
    
    if (delayed) return "bg-red-500"; // Red for delayed
    if (status === "completed") return "bg-green-500"; // Green for completed
    if (status === "in_progress") return "bg-orange-500"; // Orange for in progress
    return "bg-gray-500"; // Grey for not started
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "not_started":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
      case "on_hold":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
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
                Manage activities for selected zones
              </p>
            </div>
            <button
              onClick={() => setShowActivityForm(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Add Activity
            </button>
            <button
              onClick={() => router.push('/projects-list')}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              View Projects
            </button>
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
                  {zone.name}
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
                  const progress = activity.latest_progress?.progress_percent || 0;
                  return progress < 100 && new Date() > plannedEnd;
                });
                
                if (delayedActivities.length > 0) {
                  const firstDelayedId = `activity-${delayedActivities[0].id}`;
                  const element = document.getElementById(firstDelayedId);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight effect
                    element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                    setTimeout(() => {
                      element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                    }, 2000);
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
                    <button
                      onClick={() => setShowActivityForm(true)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Add Your First Activity
                    </button>
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
                          <div className={`w-3 h-3 rounded-full ${getStatusDotColor(activity.latest_progress?.progress_percent || 0, activity.planned_end, activity.latest_progress?.date)}`}></div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {activity.name}
                          </h3>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnhancedStatusColor(activity.latest_progress?.progress_percent || 0, activity.planned_end, activity.latest_progress?.date)}`}>
                          {(() => {
                            const progress = activity.latest_progress?.progress_percent || 0;
                            const { status, delayed } = getEnhancedStatus(progress, activity.planned_end, activity.latest_progress?.date);
                            let statusText = status.replace('_', ' ').toUpperCase();
                            if (delayed) statusText = "DELAYED";
                            return statusText;
                          })()}
                        </span>
                      </div>

                      {/* Activity Details */}
                      <div className="space-y-3">
                        {/* Planned Dates */}
                        <div className="border-l-2 border-blue-500 pl-3">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Planned</p>
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm">
                              {activity.planned_start && activity.planned_end
                                ? `${new Date(activity.planned_start).toLocaleDateString()} - ${new Date(activity.planned_end).toLocaleDateString()}`
                                : activity.planned_start
                                ? `Start: ${new Date(activity.planned_start).toLocaleDateString()}`
                                : activity.planned_end
                                ? `End: ${new Date(activity.planned_end).toLocaleDateString()}`
                                : "Not set"}
                            </span>
                          </div>
                        </div>

                        {/* Actual Dates */}
                        {activity.latest_progress && (
                          <div className="border-l-2 border-green-500 pl-3">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Actual</p>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm">
                                {new Date(activity.latest_progress.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Delay Warning */}
                        {activity.planned_end && calculateDelay(activity.planned_end, activity.latest_progress?.progress_percent || 0, activity.latest_progress?.date) && (
                          <div className="border-l-2 border-red-500 pl-3">
                            <div className="flex items-center text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-medium">
                                {(() => {
                                  const progress = activity.latest_progress?.progress_percent || 0;
                                  const { delayed, delay } = getEnhancedStatus(progress, activity.planned_end, activity.latest_progress?.date);
                                  if (delayed && delay) {
                                    return formatDelayText(delay);
                                  }
                                  return "";
                                })()}
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

                        {/* Progress Display */}
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="text-sm">
                            Progress: {activity.latest_progress ? `${activity.latest_progress.progress_percent}%` : '0%'}
                          </span>
                          {activity.latest_progress && (
                            <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">
                              ({new Date(activity.latest_progress.date).toLocaleDateString()})
                            </span>
                          )}
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
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
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.name
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      placeholder="Enter activity name"
                      disabled={submitting}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.name}
                      </p>
                    )}
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

                    {/* Status */}
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        disabled={submitting}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                        <option value="cancelled">Cancelled</option>
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
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={submitting}
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
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Progress Update Form Modal */}
          {showProgressForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="modal-container bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Update Progress
                  </h2>
                  <button
                    onClick={() => {
                      setShowProgressForm(false);
                      setSelectedActivity("");
                      setProgressErrors({});
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
                      src={getLatestProgressImage(selectedActivity)!} 
                      alt="Latest progress" 
                      className="progress-image-preview rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                )}

                <form id="progress-form" onSubmit={handleProgressSubmit} className="space-y-6">
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
                          className="progress-image-preview rounded-lg border border-gray-300 dark:border-gray-600"
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
                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProgressForm(false);
                        setSelectedActivity("");
                        setProgressErrors({});
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
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
                              {new Date(update.date).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </div>
                          </div>
                          
                          {/* Right Side - Content Card */}
                          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                            {/* Progress Percentage */}
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                              {update.progress_percent}%
                            </div>
                            
                            {/* Updated By */}
                            {update.updated_by && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span className="font-medium">Updated by:</span> {update.updated_by}
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
                                    window.open(update.image_url, '_blank');
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

// Add custom styles for modal and images
const style = document.createElement('style');
style.textContent = `
  .modal-container {
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    margin: auto;
  }
  
  .modal-container img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  
  .modal-container .progress-image-preview {
    max-height: 200px;
    object-fit: cover;
  }
`;
document.head.appendChild(style);
