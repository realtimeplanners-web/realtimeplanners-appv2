"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";
import PictorialViewer from "../../components/PictorialViewer";

export default function PictorialPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [projects, setProjects] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Set dynamic page title
  useEffect(() => {
    document.title = "Pictorial | RTP";
  }, []);

  // Check user authentication and role
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/');
        return;
      }

      // Get user data including role
      const { data: userData, error } = await supabase
        .from("users")
        .select("id, role, organization_id")
        .eq("email", user.email)
        .single();

      if (error || !userData) {
        router.push('/');
        return;
      }

      setUserRole(userData.role);
      setUserData(userData);

      // Route protection based on role
      const currentRoute = typeof window !== 'undefined' ? window.location.pathname : '';
      
      if (currentRoute.includes("super-admin") && userData.role !== "super_admin") {
        router.push('/unauthorized');
        return;
      }

      if (currentRoute.includes("org-admin") && userData.role !== "org_admin") {
        router.push('/unauthorized');
        return;
      }

      if (currentRoute.includes("user") && userData.role !== "user") {
        router.push('/unauthorized');
        return;
      }
    };

    checkAuth();
  }, [router]);

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, client_name, location, start_date, end_date")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch zones for selected project
  const fetchZones = async (projectId: string) => {
    try {
      if (!projectId) {
        setZones([]);
        return;
      }

      const { data, error } = await supabase
        .from("zones")
        .select("id, project_id, name, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error("Error fetching zones:", err);
      setZones([]);
    }
  };

  // Initialize data
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch zones when project changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchZones(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Extract project_id and zone_id from URL parameters
  useEffect(() => {
    const projectIdFromURL = searchParams.get('project_id');
    const zoneIdFromURL = searchParams.get('zone_id');
    
    if (projectIdFromURL) {
      setSelectedProjectId(projectIdFromURL);
    }
    if (zoneIdFromURL) {
      setSelectedZoneId(zoneIdFromURL);
    }
  }, [searchParams]);

  // Format date helper function
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pictorial Progress Tracker
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Visual progress tracking for construction projects
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                User: {userData?.role || 'Loading...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project and Zone Selection */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedZoneId(""); // Reset zone when project changes
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_name} - {project.client_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Zone (Optional)
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                disabled={!selectedProjectId}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">All zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Project Info */}
          {selectedProjectId && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              {(() => {
                const project = projects.find(p => p.id === selectedProjectId);
                if (!project) return null;
                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {project.project_name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Client: {project.client_name} | Location: {project.location || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Duration: {formatDate(project.start_date)} - {formatDate(project.end_date)}
                      </p>
                    </div>
                    {selectedZoneId && (() => {
                      const zone = zones.find(z => z.id === selectedZoneId);
                      return zone ? (
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Zone: {zone.name}
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Pictorial Viewer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedProjectId ? (
          <PictorialViewer 
            projectId={selectedProjectId} 
            zoneId={selectedZoneId || undefined}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                Select a Project
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Choose a project from the dropdown above to start tracking pictorial progress.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
