"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  project_name: string;
  location: string;
  start_date: string;
  end_date: string;
  created_at: string;
  organizations?: {
    organization_name: string;
  };
}

interface Activity {
  id: string;
  project_id: string;
  zone_id: string;
  name: string;
  planned_start: string;
  planned_end: string;
  duration_days: number;
  status: string;
  created_at: string;
}

interface ProgressUpdate {
  id: string;
  activity_id: string;
  date: string;
  progress_percent: number;
  remarks: string;
  image_url?: string;
  created_at: string;
}

interface ActivityWithProgress extends Activity {
  latest_progress: ProgressUpdate | null;
}

interface ActivitySummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  delayed: number;
}

export default function ProjectDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [activities, setActivities] = useState<ActivityWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [summary, setSummary] = useState<ActivitySummary>({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    delayed: 0,
  });

  // Set dynamic page title
  useEffect(() => {
    document.title = "Project Dashboard | RTP";
    
    // Ensure title persists even after page load
    const interval = setInterval(() => {
      if (document.title !== "Project Dashboard | RTP") {
        document.title = "Project Dashboard | RTP";
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Check user authentication and fetch user data
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/');
        return;
      }

      // Get user data including organization_id
      const { data: userInfo, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !userInfo) {
        router.push('/');
        return;
      }

      setUserData(userInfo);
    };

    checkAuth();
  }, [router]);

  // Fetch projects
  const fetchProjects = async () => {
    const isSuperAdmin = userData?.role === "super_admin";
    if (!isSuperAdmin && !userData?.organization_id) return;

    try {
      let query = supabase
        .from("projects")
        .select(`
          id,
          project_name,
          location,
          start_date,
          end_date,
          created_at,
          organizations!projects_organization_id_fkey ( organization_name )
        `)
        .order("created_at", { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq("organization_id", userData.organization_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching projects:", error);
      } else {
        setProjects(data || []);
        if (data && data.length > 0 && !selectedProject) {
          setSelectedProject(data[0].id);
        }
      }
    } catch (err) {
      console.error("Exception fetching projects:", err);
    }
  };

  // Fetch activities for selected project
  const fetchActivities = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      // Fetch activities for the project
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("project_id", selectedProject)
        .order("created_at", { ascending: false });

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError);
        return;
      }

      // Fetch latest progress for each activity
      const activitiesWithProgress: ActivityWithProgress[] = [];
      
      for (const activity of activitiesData || []) {
        // Get latest progress update for this activity
        const { data: progressData, error: progressError } = await supabase
          .from("progress_updates")
          .select("*")
          .eq("activity_id", activity.id)
          .order("date", { ascending: false })
          .limit(1);

        const latestProgress = progressError || !progressData || progressData.length === 0 
          ? null 
          : progressData[0];

        activitiesWithProgress.push({
          ...activity,
          latest_progress: latestProgress
        });
      }

      setActivities(activitiesWithProgress);
      calculateSummary(activitiesWithProgress);
    } catch (err) {
      console.error("Exception fetching activities:", err);
    } finally {
      setLoading(false);
    }
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

  // Get status dot color
  const getStatusDotColor = (progressPercent: number, plannedEnd: string, actualEndDate?: string) => {
    const { status, delayed } = getEnhancedStatus(progressPercent, plannedEnd, actualEndDate);
    
    if (delayed) return "bg-red-500"; // Red for delayed
    if (status === "completed") return "bg-green-500"; // Green for completed
    if (status === "in_progress") return "bg-orange-500"; // Orange for in progress
    return "bg-gray-500"; // Grey for not started
  };

  // Calculate activity summary
  const calculateSummary = (activitiesList: ActivityWithProgress[]) => {
    const summaryData: ActivitySummary = {
      total: activitiesList.length,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      delayed: 0,
    };

    activitiesList.forEach(activity => {
      const progress = activity.latest_progress?.progress_percent || 0;
      const { delayed } = getEnhancedStatus(progress, activity.planned_end, activity.latest_progress?.date);
      
      if (progress === 0) {
        summaryData.notStarted++;
      } else if (progress === 100) {
        summaryData.completed++;
      } else if (progress > 0 && progress < 100) {
        summaryData.inProgress++;
      }
      
      if (delayed) {
        summaryData.delayed++;
      }
    });

    setSummary(summaryData);
  };

  // Get project status based on activities
  const getProjectStatus = () => {
    if (summary.total === 0) return "No Activities";
    if (summary.completed === summary.total) return "Completed";
    if (summary.inProgress > 0) return "In Progress";
    return "Not Started";
  };

  // Get project status color
  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "Not Started":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.completed / summary.total) * 100);
  };

  useEffect(() => {
    if (userData) {
      fetchProjects();
    }
  }, [userData]);

  useEffect(() => {
    fetchActivities();
  }, [selectedProject]);

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Project Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor project progress and activity statistics
            </p>
          </div>

          {/* Project Selector */}
          <div className="mb-8">
            <label htmlFor="project-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Project
            </label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && selectedProjectData ? (
            <>
              {/* Project Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedProjectData.project_name}
                    </h2>
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProjectStatusColor(getProjectStatus())}`}>
                        {getProjectStatus()}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {getCompletionPercentage()}% Complete
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Organization Name</h3>
                    <p className="text-gray-900 dark:text-white">{selectedProjectData.organizations?.organization_name || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Location</h3>
                    <p className="text-gray-900 dark:text-white">{selectedProjectData.location || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duration</h3>
                    <p className="text-gray-900 dark:text-white">
                      {selectedProjectData.start_date && selectedProjectData.end_date
                        ? `${new Date(selectedProjectData.start_date).toLocaleDateString()} - ${new Date(selectedProjectData.end_date).toLocaleDateString()}`
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created</h3>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedProjectData.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                {/* Total Activities */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {summary.total}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Activities
                  </p>
                </div>

                {/* Completed */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {summary.completed}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Completed
                  </p>
                </div>

                {/* In Progress */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {summary.inProgress}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    In Progress
                  </p>
                </div>

                {/* Not Started */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {summary.notStarted}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Not Started
                  </p>
                </div>

                {/* Delayed */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {summary.delayed}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Delayed
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Overall Progress
                </h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>Completion</span>
                    <span>{getCompletionPercentage()}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${getCompletionPercentage()}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {summary.completed}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {summary.inProgress}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">In Progress</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {summary.notStarted}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Not Started</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {summary.delayed}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Delayed</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Select a Project
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a project from the dropdown to view its dashboard and activity statistics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
