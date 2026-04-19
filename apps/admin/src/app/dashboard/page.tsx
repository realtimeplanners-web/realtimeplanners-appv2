"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [dark, setDark] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [orgs, setOrgs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");

  const [newOrg, setNewOrg] = useState("");
  const [newProject, setNewProject] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Edit states
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editProjectName, setEditProjectName] = useState("");

  // Sort and filter states
  const [orgSortField, setOrgSortField] = useState<"name" | "created_at">("created_at");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc">("desc");
  const [projectSortField, setProjectSortField] = useState<"name" | "created_at">("created_at");
  const [projectSortOrder, setProjectSortOrder] = useState<"asc" | "desc">("desc");
  const [orgFilter, setOrgFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  // ✅ DARK MODE PERSIST
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") setDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  // ✅ FETCH DATA
  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("id", { ascending: false });

    if (!error) setOrgs(data || []);
  };

  const fetchProjects = async (orgId: string) => {
    if (!orgId) {
      setProjects([]);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)
      .order("id", { ascending: false });

    if (!error) setProjects(data || []);
  };

  const fetchAllProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*");

      if (error) {
        console.error('Error fetching all projects:', error);
        return;
      }
      
      console.log('Fetched all projects:', data);
      setAllProjects(data || []);
    } catch (err) {
      console.error('Exception in fetchAllProjects:', err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    fetchProjects(selectedOrg);
  }, [selectedOrg]);

  useEffect(() => {
    if (activeTab === "organizations") {
      fetchAllProjects();
    }
  }, [activeTab]);

  // ✅ LOGIN
  const handleLogin = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/dashboard";
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  // ✅ CREATE ORG
  const createOrg = async () => {
    if (!newOrg) return;

    await supabase.from("organizations").insert({ name: newOrg });
    setNewOrg("");
    await fetchOrganizations();
  };

  // ✅ CREATE PROJECT
  const createProject = async () => {
    if (!newProject || !selectedOrg) return;

    await supabase.from("projects").insert({
      name: newProject,
      organization_id: selectedOrg,
    });

    setNewProject("");
    await fetchProjects(selectedOrg);
    await fetchAllProjects();
  };

  // EDIT ORG
  const startEditOrg = (org: any) => {
    setEditingOrg(org.id);
    setEditOrgName(org.name);
  };

  const saveEditOrg = async () => {
    if (!editingOrg || !editOrgName) return;

    await supabase
      .from("organizations")
      .update({ name: editOrgName })
      .eq("id", editingOrg);

    setEditingOrg(null);
    setEditOrgName("");
    await fetchOrganizations();
  };

  const cancelEditOrg = () => {
    setEditingOrg(null);
    setEditOrgName("");
  };

  // EDIT PROJECT
  const startEditProject = (project: any) => {
    setEditingProject(project.id);
    setEditProjectName(project.name);
  };

  const saveEditProject = async () => {
    if (!editingProject || !editProjectName) return;

    await supabase
      .from("projects")
      .update({ name: editProjectName })
      .eq("id", editingProject);

    setEditingProject(null);
    setEditProjectName("");
    await fetchProjects(selectedOrg);
    await fetchAllProjects();
  };

  const cancelEditProject = () => {
    setEditingProject(null);
    setEditProjectName("");
  };

  // SORTING AND FILTERING
  const sortOrgs = (field: "name" | "created_at") => {
    if (orgSortField === field) {
      setOrgSortOrder(orgSortOrder === "asc" ? "desc" : "asc");
    } else {
      setOrgSortField(field);
      setOrgSortOrder("asc");
    }
  };

  const sortProjects = (field: "name" | "created_at") => {
    if (projectSortField === field) {
      setProjectSortOrder(projectSortOrder === "asc" ? "desc" : "asc");
    } else {
      setProjectSortField(field);
      setProjectSortOrder("asc");
    }
  };

  const getFilteredAndSortedOrgs = () => {
    let filtered = orgs.filter(org => 
      org.name.toLowerCase().includes(orgFilter.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue = a[orgSortField];
      let bValue = b[orgSortField];

      if (orgSortField === "created_at") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (orgSortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const getFilteredAndSortedProjects = () => {
    let filtered = projects.filter(project => 
      project.name.toLowerCase().includes(projectFilter.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue = a[projectSortField];
      let bValue = b[projectSortField];

      if (projectSortField === "created_at") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (projectSortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex min-h-screen font-sans antialiased">
        {/* SIDEBAR */}
        <div
          className={`${
            sidebarOpen ? "w-64" : "w-16"
          } bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white transition-all duration-300 p-4 flex flex-col shadow-2xl border-r border-purple-800/30`}
        >
          {/* TOP ROW */}
          <div className="flex items-center justify-between mb-4">
            {/* LOGO - Only show when sidebar is open */}
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="font-bold text-lg bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">RealTimePlanners</h2>
              </div>
            )}

            {/* TOGGLE BUTTON - Always in top right */}
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 hover:scale-105 bg-white/20 border border-white/30 shadow-lg"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* MENU */}
          <div className="flex-1 space-y-2">
            {/* DASHBOARD */}
            <div
              onClick={() => setActiveTab("dashboard")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "dashboard" 
                  ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-400/50 shadow-lg shadow-emerald-500/20" 
                  : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "dashboard" ? "text-emerald-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Dashboard</span>}
            </div>

            {/* ORGANIZATIONS */}
            <div
              onClick={() => setActiveTab("organizations")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "organizations"
                  ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-400/50 shadow-lg shadow-blue-500/20"
                  : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "organizations" ? "text-blue-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Organizations</span>}
            </div>

            {/* PROJECTS */}
            <div
              onClick={() => setActiveTab("projects")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "projects" ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-400/50 shadow-lg shadow-purple-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "projects" ? "text-purple-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Projects</span>}
            </div>
          </div>

          {/* BOTTOM CONTROLS */}
          <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
            {/* THEME TOGGLE */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-white/10 transition-all duration-300 hover:scale-105"
            >
              <div className="relative w-8 h-8">
                {dark ? (
                  <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 18a6 6 0 100-12 6 6 0 000 12zM11 1h2v3h-2V1zm0 18h2v3h-2v-3zM3.515 4.929l1.414-1.414L7.05 5.636 5.636 7.05 3.515 4.929zM16.95 18.364l1.414 1.414 2.121-2.121-1.414-1.414-2.121 2.121zm2.121-14.85l1.414 1.415-2.121 2.121-1.414-1.414 2.121-2.121zM5.636 16.95l1.414 1.414-2.121 2.121-1.414-1.414 2.121-2.121zM23 11v2h-3v-2h3zM4 11v2H1v-2h3z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-indigo-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                )}
              </div>
              {sidebarOpen && <span className="ml-3 text-sm font-medium">Theme</span>}
            </button>

            {/* LOGOUT */}
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

        {/* MAIN */}
        <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 text-black dark:text-white">
          {/* TOP BAR - STICKY */}
          <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/90 dark:bg-black/90 border-b border-white/20 dark:border-black/20">
            <div className="flex justify-between items-center p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">SUPER ADMIN PANEL</h1>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">RealTimePlanners Project Management System</p>
                </div>
              </div>
              
              {/* USER INFO SECTION */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase">RealTimePlanners</p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
                <div className="relative group">
                  <div className="w-12 h-12 bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer overflow-hidden">
                    <img 
                      src="" 
                      alt="User Avatar" 
                      className="w-full h-full object-cover hidden"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const img = e.target?.result as string;
                          // Update avatar display
                          const avatarImg = document.querySelector('img[alt="User Avatar"]') as HTMLImageElement;
                          if (avatarImg && img) {
                            avatarImg.src = img;
                            avatarImg.style.display = 'block';
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-black"></div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="p-6">

          {/* TAB CONTENT */}
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-2 gap-6">
              {/* ORGS */}
              <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20">
                <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-blue-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">ORGANIZATIONS</h2>
                  </div>
                </div>
                <div className="p-6">
                  <input
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createOrg()}
                    placeholder="New Organization"
                    className="w-full mb-4 px-4 py-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  />

                  <button
                    onClick={createOrg}
                    className="w-full mb-4 group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl hover:from-emerald-600 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Organization
                  </button>

                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="w-full px-4 py-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  >
                    <option value="">Select Organization</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PROJECTS */}
              <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20">
                <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:via-pink-500/20 dark:to-indigo-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 bg-clip-text text-transparent">PROJECTS</h2>
                  </div>
                </div>
                <div className="p-6">
                  <input
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                    placeholder="New Project"
                    className="w-full mb-4 px-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  />

                  <button
                    onClick={createProject}
                    className="w-full mb-4 group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Project
                  </button>

                  <div className="space-y-2">
                    {projects.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400">No projects yet</p>
                      </div>
                    ) : (
                      projects.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 border border-purple-200 dark:border-purple-800 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "organizations" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col max-h-[600px]">
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-blue-500/20 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">ORGANIZATIONS</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Manage Your Organization Portfolio</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={orgFilter}
                        onChange={(e) => setOrgFilter(e.target.value)}
                        placeholder="Search Organizations..."
                        className="pl-10 pr-4 py-2.5 w-64 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      />
                      <svg className="absolute left-3 top-2.5 w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newOrg}
                        onChange={(e) => setNewOrg(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createOrg()}
                        placeholder="New Organization"
                        className="px-4 py-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      />
                      <button
                        onClick={createOrg}
                        className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl hover:from-emerald-600 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:scale-105"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full">
                  <thead className="sticky top-0 z-30 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border-b border-emerald-200 dark:border-emerald-800 backdrop-blur-sm shadow-md">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        <button
                          onClick={() => sortOrgs("name")}
                          className="flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          ORGANIZATION NAME
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        <button
                          onClick={() => sortOrgs("created_at")}
                          className="flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          CREATED DATE
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        PROJECTS COUNT
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredAndSortedOrgs().length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-3">
                            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <p className="text-lg font-medium">No organizations found</p>
                            <p className="text-sm">Create your first organization to get started</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSortedOrgs().map((org) => (
                        <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {editingOrg === org.id ? (
                                <input
                                  type="text"
                                  value={editOrgName}
                                  onChange={(e) => setEditOrgName(e.target.value)}
                                  className="px-2 py-1 border border-blue-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
                                />
                              ) : (
                                org.name
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                            {new Date(org.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                            {allProjects.filter(p => p.organization_id === org.id).length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {editingOrg === org.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={saveEditOrg}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditOrg}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => startEditOrg(org)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => setSelectedOrg(org.id)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  Select
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col max-h-[600px]">
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:via-pink-500/20 dark:to-indigo-500/20 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 bg-clip-text text-transparent">PROJECTS</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Manage Your Project Portfolio</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        placeholder="Search Projects..."
                        className="pl-10 pr-4 py-2.5 w-64 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      />
                      <svg className="absolute left-3 top-2.5 w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}
                        className="px-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="">Select Organization</option>
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createProject()}
                        placeholder="New Project"
                        className="px-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      />
                      <button
                        onClick={createProject}
                        className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full">
                  <thead className="sticky top-0 z-30 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-200 dark:border-purple-800 backdrop-blur-sm shadow-md">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        <button
                          onClick={() => sortProjects("name")}
                          className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                          PROJECT NAME
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        ORGANIZATION
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        <button
                          onClick={() => sortProjects("created_at")}
                          className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                          CREATED DATE
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          </svg>
                        </button>
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {getFilteredAndSortedProjects().length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-3">
                            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <p className="text-lg font-medium">No projects found</p>
                            <p className="text-sm">Select an organization and create your first project</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSortedProjects().map((project) => (
                        <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingProject === project.id ? (
                              <input
                                type="text"
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <span className="text-sm text-gray-900 dark:text-white">
                                {orgs.find(o => o.id === project.organization_id)?.name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(project.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {editingProject === project.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={saveEditProject}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditProject}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => startEditProject(project)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700 rounded transition-colors">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
