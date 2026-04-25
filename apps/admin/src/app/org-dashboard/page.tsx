"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

export default function OrgDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Set dynamic page title
  useEffect(() => {
    document.title = "Org Admin | RTP";
  }, [searchParams]); // Include searchParams to handle URL changes
  
  const [orgName, setOrgName] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

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
      localStorage.setItem(`orgDashboard_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`orgDashboard_${key}`);
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

  useEffect(() => {
    const checkAccess = async () => {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.href = "/";
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("role, organization_id")
        .eq("id", authData.user.id)
        .single();

      if (userData?.role !== "org_admin") {
        alert("Unauthorized access");
        window.location.href = "/";
        return;
      }

      // Fetch organization details
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", userData.organization_id)
        .single();

      if (orgData) {
        setOrgName(orgData.name);
      }

      // Fetch projects for this organization using the actual organization_id
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", userData.organization_id);

      setProjects(projectData || []);
    };

    checkAccess();
  }, []);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
        
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-64" : "w-20"} bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-in-out flex flex-col shadow-xl`}>
          
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between">
              {sidebarOpen && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">Org Admin</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{orgName}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 bg-white/20 border border-white/30 shadow-lg"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
              { id: "projects", label: "Projects", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
              { id: "project-dashboard", label: "Project Dashboard", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { id: "reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => item.id === "project-dashboard" ? window.location.href = "/project-dashboard" : setActiveTab(item.id)}
                className={`w-full flex items-center ${
                  sidebarOpen ? "justify-start" : "justify-center"
                } gap-3 px-4 py-3 rounded-xl transition-all duration-300 hover:scale-105 ${
                  activeTab === item.id
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className={`w-5 h-5 flex items-center justify-center ${
                  activeTab === item.id ? "text-blue-400" : "text-gray-400"
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-red-500/20 transition-all duration-300 hover:scale-105 group"
            >
              <svg className="w-5 h-5 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span className="ml-3 text-sm font-medium">Logout</span>}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg">
            <div className="flex justify-between items-center p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {activeTab === "dashboard" && "Dashboard"}
                    {activeTab === "projects" && "Projects"}
                    {activeTab === "reports" && "Reports"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Welcome back to {orgName}
                  </p>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDark(!dark)}
                className="relative w-8 h-8 rounded-full hover:scale-110 transition-transform"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  dark ? "bg-yellow-400/20" : "bg-indigo-400/20"
                }`}>
                  {dark ? (
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 18a6 6 0 100-12 6 6 0 000 12zM11 1h2v3h-2V1zm0 18h2v3h-2v-3zM3.515 4.929l1.414-1.414L7.05 5.636 5.636 7.05 3.515 4.929zM16.95 18.364l1.414 1.414 2.121-2.121-1.414-1.414-2.121 2.121zm2.121-14.85l1.414 1.415-2.121 2.121-1.414-1.414 2.121-2.121zM5.636 16.95l1.414 1.414-2.121 2.121-1.414-1.414 2.121-2.121zM23 11v2h-3v-2h3zM4 11v2H1v-2h3z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  )}
                </div>
              </button>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-auto p-6">
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Total Projects</h3>
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{projects.length}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Active projects</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 p-6 rounded-2xl border border-green-200/50 dark:border-green-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">Organization</h3>
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 truncate">{orgName}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Your organization</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 p-6 rounded-2xl border border-purple-200/50 dark:border-purple-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Quick Actions</h3>
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push('/create-project')}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-2 rounded-lg transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105"
                    >
                      Create Project
                    </button>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Projects</h3>
                  </div>
                  <div className="p-6">
                    {projects.length === 0 ? (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">No projects yet</p>
                        <button 
                          onClick={() => router.push('/create-project')}
                          className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          Create Your First Project
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {projects.map((project) => (
                          <div key={project.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-102 cursor-pointer"
                               onClick={() => router.push(`/project-details?project_id=${project.id}`)}>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{project.name}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Created: {new Date(project.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "projects" && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">All Projects</h3>
                  <button 
                    onClick={() => router.push('/create-project')}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Project
                  </button>
                </div>
                <div className="p-6">
                  {projects.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 dark:text-gray-400">No projects found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {projects.map((project) => (
                        <div key={project.id} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                             onClick={() => router.push(`/project-details?project_id=${project.id}`)}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              project.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {project.status || 'Active'}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{project.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {project.client_name || 'No client specified'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            Created: {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "reports" && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Reports Coming Soon</h3>
                  <p className="text-gray-500 dark:text-gray-400">Advanced reporting and analytics features will be available soon.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
