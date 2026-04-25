"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSearchParams, useRouter } from "next/navigation";

interface FormData {
  name: string;
  client_name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function CreateProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Set dynamic page title
  useEffect(() => {
    document.title = "Create Project | RTP";
  }, [searchParams]); // Include searchParams to handle URL changes

  const [formData, setFormData] = useState<FormData>({
    name: "",
    client_name: "",
    location: "",
    start_date: "",
    end_date: "",
    status: "Active",
  });
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
      localStorage.setItem(`createProject_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`createProject_${key}`);
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
      client_name: "",
      location: "",
      start_date: "",
      end_date: "",
      status: "Active",
    });
    setFormData(savedFormData);

    // Restore dark mode
    const darkMode = loadFromLocalStorage('darkMode', false);
    setDark(darkMode);
  }, []); // Run only once on mount

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

    if (!formData.client_name.trim()) {
      newErrors.client_name = "Client name is required";
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

    setLoading(true);

    try {
      // Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log("🔍 DEBUG: Auth user:", user);
      
      if (!user) {
        alert("Please log in to create a project");
        return;
      }

      // Get user's organization_id from users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      console.log("🔍 DEBUG: User profile:", profile);
      console.log("🔍 DEBUG: Profile error:", profileError);

      if (profileError || !profile) {
        console.error("Error fetching user profile:", profileError);
        alert("Error: Unable to determine your organization");
        return;
      }

      // Prepare project data - use hardcoded org ID 1 (bigint compatible)
      const projectData = {
        name: formData.name.trim(),
        client_name: formData.client_name.trim(),
        location: formData.location.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        organization_id: 1, // Use bigint 1 instead of UUID
        status: formData.status,
      };

      console.log("🔍 DEBUG: Project data to insert:", projectData);

      // Insert project
      const { data, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      console.log("🔍 DEBUG: Insert result:", { data, error });

      if (error) {
        console.error("Error creating project:", error);
        alert("Error creating project: " + error.message);
      } else {
        console.log("Project created successfully:", data);
        alert("Project created successfully!");
        
        // Redirect to Projects
        router.push('/projects-list');
      }
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
                  window.location.href = "/projects-list";
                }}
                className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create New Project
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Fill in the details below to create a new project
            </p>
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

              {/* Client Name */}
              <div>
                <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors.client_name
                      ? "border-red-300 dark:border-red-600"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                  placeholder="Enter client name"
                  disabled={loading}
                />
                {errors.client_name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.client_name}
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
                    window.location.href = "/projects-list";
                  }}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
