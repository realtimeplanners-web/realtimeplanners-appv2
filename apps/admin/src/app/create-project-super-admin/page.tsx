"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

interface FormData {
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function CreateProjectSAdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Set dynamic page title
  useEffect(() => {
    document.title = "Create Project (Super Admin) | RTP";
  }, [searchParams]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    status: "Active",
  });
  const [selectedOrgName, setSelectedOrgName] = useState<string>("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});

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
      localStorage.setItem(`createProjectSAdmin_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`createProjectSAdmin_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return defaultValue;
    }
  }, []);

  // Initialize state from localStorage
  useEffect(() => {
    // Restore form data
    const savedFormData = loadFromLocalStorage('formData', {
      name: "",
      location: "",
      start_date: "",
      end_date: "",
      status: "Active",
    });
    setFormData(savedFormData);

    // Restore dark mode
    const darkMode = loadFromLocalStorage('darkMode', false);
    setDark(darkMode);
  }, []);

  // Save form data changes to localStorage
  useEffect(() => {
    saveToLocalStorage('formData', formData);
  }, [formData]);

  useEffect(() => {
    saveToLocalStorage('darkMode', dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Fetch organizations for dropdown
  useEffect(() => {
    const fetchOrganizations = async () => {
      console.log("🔍 DEBUG: Fetching organizations for super admin dropdown...");
      const { data: orgsData, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name", { ascending: true });

      console.log("🔍 DEBUG: Organizations fetched:", orgsData);
      console.log("🔍 DEBUG: Organizations error:", error);

      if (error) {
        console.error("🔍 DEBUG: Error fetching organizations:", error);
      } else {
        console.log("🔍 DEBUG: Setting organizations state with:", orgsData?.length || 0, "organizations");
        setOrganizations(orgsData || []);
      }
    };

    fetchOrganizations();
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Project name is required";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    }

    if (!formData.start_date) {
      newErrors.start_date = "Start date is required";
    }

    if (!formData.end_date) {
      newErrors.end_date = "End date is required";
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = "End date must be after start date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!selectedOrgId) {
      alert("Please select an organization before creating a project");
      return;
    }

    setLoading(true);

    console.log("🔍 DEBUG SUPER ADMIN CREATE: Selected organization ID:", selectedOrgId);
    console.log("🔍 DEBUG SUPER ADMIN CREATE: Selected organization name:", selectedOrgName);

    // Get current user session
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("You must be logged in to create a project");
      setLoading(false);
      return;
    }

    // Fetch correct user from public.users using email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user from public.users:", userError);
      alert("Error: User not found in public.users");
      setLoading(false);
      return;
    }

    // Prepare project data - use selected organization from dropdown
    const projectData = {
      name: formData.name.trim(),
      location: formData.location.trim(),
      start_date: formData.start_date,
      end_date: formData.end_date,
      organization_id: selectedOrgId, // Use selected organization ID from dropdown
      status: formData.status,
      created_by: userData.id, // Use public.users.id to satisfy foreign key constraint
    };

    console.log("🔍 DEBUG SUPER ADMIN CREATE: Project data to insert:", projectData);

    try {
      // Insert project
      const { data: insertResult, error: insertError } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      console.log("🔍 DEBUG SUPER ADMIN CREATE: Insert result:", { insertResult, insertError });

      if (insertError) {
        console.error("Error creating project:", insertError);
        alert("Error creating project: " + insertError.message);
        setLoading(false);
        return;
      }

      // Verify the created project has the correct organization_id
      console.log("🔍 DEBUG SUPER ADMIN CREATE: Created project:", insertResult);
      console.log("🔍 DEBUG SUPER ADMIN CREATE: Created project organization_id:", insertResult?.organization_id);

      console.log("Project created successfully by super admin:", insertResult);
      alert("Project created successfully!");
        
      // Redirect to Super Admin Dashboard
      router.push('/super-admin');
    } catch (err) {
      console.error("Exception creating project:", err);
      alert("An unexpected error occurred while creating the project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <button
                onClick={() => {
                  router.push('/super-admin');
                }}
                className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create New Project (Super Admin)
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Fill in the details below to create a new project as Super Admin
            </p>

            {/* Organization Dropdown */}
            <div className="mt-6">
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization *
              </label>
              <select
                id="organization"
                name="organization"
                value={selectedOrgId}
                onChange={(e) => {
                  const orgId = e.target.value;
                  setSelectedOrgId(orgId);
                  const org = organizations.find(o => o.id === orgId);
                  setSelectedOrgName(org?.organization_name || "");
                }}
                className={`w-full px-4 py-3 rounded-lg border ${
                  selectedOrgId
                    ? "border-green-300 dark:border-green-600"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
              >
                <option value="">Select an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.name
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                  placeholder="Enter project name"
                  disabled={loading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.name}
                  </p>
                )}
              </div>

              
              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.location
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                  placeholder="Enter project location"
                  disabled={loading}
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.location}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status *
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange(e)}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.status
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                  disabled={loading}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Upcoming">Upcoming</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.status}
                  </p>
                )}
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date */}
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      errors.start_date
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                    disabled={loading}
                  />
                  {errors.start_date && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.start_date}
                    </p>
                  )}
                </div>

                {/* End Date */}
                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    min={formData.start_date}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      errors.end_date
                        ? "border-red-300 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                    disabled={loading}
                  />
                  {errors.end_date && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.end_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    router.push('/super-admin');
                  }}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create Project"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
