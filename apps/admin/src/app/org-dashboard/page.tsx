"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function OrgDashboardPage() {
  const [orgName, setOrgName] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [dark, setDark] = useState(false);

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

      // Fetch projects for this organization
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              Organization Dashboard
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Welcome to {orgName}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl">
                <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">
                  Projects ({projects.length})
                </h2>
                <div className="space-y-3">
                  {projects.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No projects yet</p>
                  ) : (
                    projects.map((project) => (
                      <div
                        key={project.id}
                        className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow"
                      >
                        <h3 className="font-medium text-gray-800 dark:text-white">
                          {project.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Created: {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl">
                <h2 className="text-xl font-semibold text-green-800 dark:text-green-300 mb-4">
                  Quick Actions
                </h2>
                <div className="space-y-3">
                  <button className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg transition-colors">
                    Create New Project
                  </button>
                  <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors">
                    View Reports
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
