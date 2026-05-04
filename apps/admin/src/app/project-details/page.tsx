"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

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

interface Zone {
  id: string;
  project_id: string;
  zone_name: string;
  created_at: string;
}

export default function ProjectDetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dark, setDark] = useState(false);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneError, setZoneError] = useState("");

  // Set dynamic page title
  useEffect(() => {
    if (project?.project_name) {
      document.title = `${project.project_name} | RTP`;
    } else {
      document.title = "Project Details | RTP";
    }
  }, [project, searchParams]); // Include searchParams to handle URL changes

  // Get project ID from URL parameters
  const projectId = searchParams.get('project_id') || '';

  // Fetch project details
  const fetchProject = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error("Error fetching project:", error);
      } else {
        setProject(data);
      }
    } catch (err) {
      console.error("Exception fetching project:", err);
    }
  };

  // Fetch zones for this project
  const fetchZones = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from("zones")
        .select("id, project_id, zone_name, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching zones:", error);
      } else {
        setZones(data || []);
      }
    } catch (err) {
      console.error("Exception fetching zones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchZones();
    }
  }, [projectId]);

  // Handle zone creation
  const handleZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!zoneName.trim()) {
      setZoneError("Zone name is required");
      return;
    }

    setSubmitting(true);
    setZoneError("");

    try {
      // Insert zone into Supabase
      const { data, error } = await supabase
        .from("zones")
        .insert({
          zone_name: zoneName.trim(),
          project_id: projectId,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating zone:", error);
        setZoneError("Error creating zone: " + error.message);
      } else {
        console.log("Zone created successfully:", data);
        alert("Zone created successfully!");
        
        // Reset form and close
        setZoneName("");
        setShowZoneForm(false);
        
        // Refresh zones list
        fetchZones();
      }
    } catch (err) {
      console.error("Exception creating zone:", err);
      setZoneError("An unexpected error occurred while creating the zone.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle zone click - navigate to activities page
  const handleZoneClick = (zoneId: string, zoneName: string) => {
    // Navigate within same app window with full context
    router.push(
      `/activities?project_id=${projectId}&zone=${zoneId}&zone_id=${zoneId}&zone_name=${encodeURIComponent(zoneName)}`
    );
  };

  // Calculate project status
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

  if (!projectId) {
    return (
      <div className={dark ? "dark" : ""}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                No Project Selected
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please select a project from the projects list to view details.
              </p>
              <button
                onClick={() => {
                  router.push("/projects-list");
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Go to Projects List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <button
                onClick={() => {
                  router.push("/projects-list");
                }}
                className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Project Details
              </h1>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Project Information */}
              {project && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {project.project_name}
                      </h2>
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getProjectStatus(project.start_date, project.end_date))}`}>
                          {getProjectStatus(project.start_date, project.end_date)}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Created: {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Client</h3>
                      <p className="text-gray-900 dark:text-white">{project.client_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Location</h3>
                      <p className="text-gray-900 dark:text-white">{project.location || "Not specified"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duration</h3>
                      <p className="text-gray-900 dark:text-white">
                        {project.start_date && project.end_date
                          ? `${new Date(project.start_date).toLocaleDateString()} - ${new Date(project.end_date).toLocaleDateString()}`
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Zones Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Zones
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Manage zones for this project
                    </p>
                  </div>
                  <button
                    onClick={() => setShowZoneForm(true)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Add Zone
                  </button>
                </div>

                {/* Zones List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {zones.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        No Zones Yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Create zones to organize activities within this project
                      </p>
                      <button
                        onClick={() => setShowZoneForm(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Create Your First Zone
                      </button>
                    </div>
                  ) : (
                    zones.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => handleZoneClick(zone.id, zone.zone_name)}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {zone.zone_name}
                          </h3>
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Click to manage activities
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          Created: {new Date(zone.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Zone Form Modal */}
          {showZoneForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Create New Zone
                  </h2>
                  <button
                    onClick={() => {
                      setShowZoneForm(false);
                      setZoneName("");
                      setZoneError("");
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleZoneSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="zone-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Zone Name *
                    </label>
                    <input
                      type="text"
                      id="zone-name"
                      value={zoneName}
                      onChange={(e) => {
                        setZoneName(e.target.value);
                        if (zoneError) setZoneError("");
                      }}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        zoneError
                          ? "border-red-300 dark:border-red-600"
                          : "border-gray-300 dark:border-gray-600"
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      placeholder="Enter zone name"
                      disabled={submitting}
                    />
                    {zoneError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {zoneError}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowZoneForm(false);
                        setZoneName("");
                        setZoneError("");
                      }}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                        "Create Zone"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
