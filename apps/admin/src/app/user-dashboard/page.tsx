"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { handleLogout } from "../lib/auth";

interface Project {
  id: string;
  project_name: string;
  client_name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

interface ActivitySummary {
  total: number;
  delayed: number;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Set dynamic page title
  useEffect(() => {
    document.title = "User Dashboard | RTP";
  }, []);

  // PROTECT USER DASHBOARD PAGE - Authentication and Role Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking user dashboard authentication...');
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error('No authenticated user found:', authError);
          window.location.href = "/";
          return;
        }
        
        console.log('User authenticated:', user.id);
        
        // Get user data including role
        const { data: userInfo, error: userError } = await supabase
          .from("users")
          .select("role, organization_id, user_name, email")
          .eq("id", user.id)
          .single();

        if (userError || !userInfo) {
          console.error('Error fetching user info:', userError);
          window.location.href = "/";
          return;
        }
        
        // Check if user has user role (or super_admin for access)
        if (userInfo.role !== "user" && userInfo.role !== "super_admin" && userInfo.role !== "org_admin") {
          console.error(`Access denied: User role is ${userInfo.role}, required user, org_admin, or super_admin`);
          window.location.href = "/";
          return;
        }
        
        console.log('User dashboard authentication confirmed, role:', userInfo.role);
        
        // Set user data for the page
        setUserData(userInfo);
        
        // Fetch user projects
        fetchUserProjects(userInfo.organization_id);
        
      } catch (error) {
        console.error('Exception during authentication check:', error);
        window.location.href = "/";
      }
    };
    
    checkAuth();
  }, []);

  // Fetch projects for user's organization only
  const fetchUserProjects = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching projects:", error);
        return;
      }

      setProjects(data || []);
    } catch (err) {
      console.error("Exception fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities summary for a project
  const fetchActivitiesSummary = async (projectId: string): Promise<ActivitySummary> => {
    try {
      const { data: activities, error } = await supabase
        .from("activities")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        console.error("Error fetching activities:", error);
        return { total: 0, delayed: 0 };
      }

      const total = activities?.length || 0;
      const delayed = activities?.filter(activity => {
        const plannedEnd = new Date(activity.planned_end);
        const now = new Date();
        return now > plannedEnd;
      }).length || 0;

      return { total, delayed };
    } catch (err) {
      console.error("Exception fetching activities summary:", err);
      return { total: 0, delayed: 0 };
    }
  };

  // Handle project navigation
  const handleOpenProject = (projectId: string) => {
    router.push(`/activities?project_id=${projectId}`);
  };

  // Separate component for project card to handle hooks properly
function ProjectCard({ project, onOpenProject }: { project: Project; onOpenProject: (projectId: string) => void }) {
  const [activitiesSummary, setActivitiesSummary] = useState<ActivitySummary>({ total: 0, delayed: 0 });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data: activities, error } = await supabase
          .from("activities")
          .select("*")
          .eq("project_id", project.id);

        if (error) {
          console.error("Error fetching activities:", error);
          return;
        }

        const total = activities?.length || 0;
        const delayed = activities?.filter(activity => {
          const plannedEnd = new Date(activity.planned_end);
          const now = new Date();
          return now > plannedEnd;
        }).length || 0;

        setActivitiesSummary({ total, delayed });
      } catch (err) {
        console.error("Exception fetching activities summary:", err);
      }
    };

    fetchSummary();
  }, [project.id]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
      <div className="p-6">
        {/* Project Header */}
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
            {project.project_name}
          </h3>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-2">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {project.location || "No location specified"}
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {project.client_name}
          </div>
        </div>

        {/* Activities Summary */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Total Activities</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {activitiesSummary.total}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Delayed Activities</span>
            <span className={`font-semibold ${activitiesSummary.delayed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {activitiesSummary.delayed}
            </span>
          </div>
        </div>

        {/* Open Project Button */}
        <button
          onClick={() => onOpenProject(project.id)}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Open Project
        </button>
      </div>
    </div>
  );
}

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                User Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Your assigned projects and activities
              </p>
              {userData && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  User : {userData.email}
                </p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Projects Assigned
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don't have any projects assigned to you yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onOpenProject={handleOpenProject} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
