"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  client_name: string;
  location: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsListPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  // Set dynamic page title
  useEffect(() => {
    document.title = "Projects | RTP";
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
      localStorage.setItem(`projectsList_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`projectsList_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return defaultValue;
    }
  }, []);

  // Initialize state from localStorage
  useEffect(() => {
    // Restore dark mode
    const darkMode = loadFromLocalStorage('darkMode', false);
    setDark(darkMode);
  }, []); // Run only once on mount

  useEffect(() => {
    saveToLocalStorage('darkMode', dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Fetch projects from Supabase with organization join
  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          client_name,
          location,
          start_date,
          end_date,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching projects:", error);
      } else {
        setProjects(data || []);
      }
    } catch (err) {
      console.error("Exception fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Calculate project status based on dates
  const getProjectStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!startDate || !endDate) return "Not Scheduled";
    if (now < start) return "Upcoming";
    if (now >= start && now <= end) return "In Progress";
    if (now > end) return "Completed";
    return "Not Scheduled";
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "Upcoming":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
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
                Projects
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage and track all your construction projects
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/create-project')}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Create Project
              </button>
              <button
                onClick={() => router.push('/activities')}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                View Activities
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            /* Projects Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No Projects Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Get started by creating your first project
                    </p>
                    <button
                      onClick={() => router.push('/create-project')}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Create Your First Project
                    </button>
                  </div>
                </div>
              ) : (
                projects.map((project) => {
                  const status = getProjectStatus(project.start_date, project.end_date);
                  return (
                    <div
                      key={project.id}
                      onClick={() => {
                        // Navigate to project details page
                        window.location.href = `/project-details?project_id=${project.id}`;
                      }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:scale-105"
                    >
                      <div className="p-6">
                        {/* Project Header */}
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {project.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {status}
                          </span>
                        </div>

                        {/* Project Details */}
                        <div className="space-y-3">
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-sm truncate">
                              {project.location || "No location specified"}
                            </span>
                          </div>

                          
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-sm truncate">
                              {project.client_name}
                            </span>
                          </div>

                          {/* Dates */}
                          {(project.start_date || project.end_date) && (
                            <div className="flex items-center text-gray-500 dark:text-gray-500 text-xs">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {project.start_date && project.end_date
                                ? `${new Date(project.start_date).toLocaleDateString()} - ${new Date(project.end_date).toLocaleDateString()}`
                                : project.start_date
                                ? `Start: ${new Date(project.start_date).toLocaleDateString()}`
                                : project.end_date
                                ? `End: ${new Date(project.end_date).toLocaleDateString()}`
                                : "No dates set"}
                            </div>
                          )}
                        </div>

                        {/* Click indicator */}
                        <div className="mt-4 flex items-center text-blue-500 dark:text-blue-400 text-sm font-medium">
                          <span>View Details</span>
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
