"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

interface Issue {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  page_url: string;
  user_email: string;
  screenshot_url: string;
  browser_info: string;
  created_at: string;
  updated_at: string;
}

export default function IssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "general",
    page_url: "",
    user_email: "",
    browser_info: "",
  });

  // Load dark mode preference
  useEffect(() => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    setDark(darkMode);
  }, []);

  // Fetch issues
  const fetchIssues = async () => {
    try {
      console.log("🔍 DEBUG: Fetching issues from database...");
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("🔍 DEBUG: Error fetching issues:", error);
        console.error("🔍 DEBUG: Error details:", error.details);
        console.error("🔍 DEBUG: Error code:", error.code);
      } else {
        console.log("🔍 DEBUG: Issues fetched successfully:", data);
        console.log("🔍 DEBUG: Number of issues:", data?.length || 0);
        setIssues(data || []);
      }
    } catch (err) {
      console.error("🔍 DEBUG: Exception fetching issues:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle screenshot file selection
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload screenshot to Supabase storage
  const uploadScreenshot = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading screenshot:", uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Exception uploading screenshot:", err);
      return null;
    }
  };

  // Create new issue
  const createIssue = async () => {
    if (!formData.title.trim()) {
      alert("Please enter an issue title");
      return;
    }

    try {
      let screenshotUrl = null;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot(screenshotFile);
      }

      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        url: window.location.href,
      };

      const { data, error } = await supabase
        .from("issues")
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim(),
          severity: formData.severity,
          category: formData.category,
          page_url: formData.page_url || window.location.href,
          user_email: formData.user_email || "unknown@example.com",
          screenshot_url: screenshotUrl,
          browser_info: JSON.stringify(browserInfo),
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating issue:", error);
        alert("Error creating issue: " + error.message);
      } else {
        console.log("Issue created successfully:", data);
        alert("Issue created successfully!");
        
        // Reset form
        setFormData({
          title: "",
          description: "",
          severity: "medium",
          category: "general",
          page_url: "",
          user_email: "",
          browser_info: "",
        });
        setScreenshotFile(null);
        setScreenshotPreview(null);
        setShowCreateForm(false);
        
        // Refresh issues list
        fetchIssues();
      }
    } catch (err) {
      console.error("Exception creating issue:", err);
      alert("An unexpected error occurred while creating the issue.");
    }
  };

  // Test function to create a test issue
  const createTestIssue = async () => {
    try {
      console.log("🔍 DEBUG: Creating test issue...");
      
      const testIssue = {
        title: "Test Issue - " + new Date().toISOString(),
        description: "This is a test issue to verify database connection",
        severity: "medium",
        category: "general",
        page_url: window.location.href,
        user_email: "test@example.com",
        browser_info: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          test: true
        })
      };

      const { data, error } = await supabase
        .from("issues")
        .insert(testIssue)
        .select()
        .single();

      if (error) {
        console.error("🔍 DEBUG: Error creating test issue:", error);
        console.error("🔍 DEBUG: Error details:", error.details);
        console.error("🔍 DEBUG: Error code:", error.code);
        alert("Failed to create test issue: " + error.message);
      } else {
        console.log("🔍 DEBUG: Test issue created successfully:", data);
        alert("Test issue created successfully!");
        fetchIssues();
      }
    } catch (err) {
      console.error("🔍 DEBUG: Exception creating test issue:", err);
      alert("Exception creating test issue: " + err);
    }
  };

  // Update issue status
  const updateIssueStatus = async (issueId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("issues")
        .update({ 
          status: newStatus,
          resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null
        })
        .eq("id", issueId);

      if (error) {
        console.error("Error updating issue:", error);
        alert("Error updating issue: " + error.message);
      } else {
        fetchIssues();
      }
    } catch (err) {
      console.error("Exception updating issue:", err);
      alert("An unexpected error occurred while updating the issue.");
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 mb-8">
            <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-rose-500/10 dark:from-red-500/20 dark:via-pink-500/20 dark:to-rose-500/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-tr from-red-400 via-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">ISSUES MANAGEMENT</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Debug & Track Application Issues</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transform hover:scale-105"
                  >
                    Create Issue
                  </button>
                  <button
                    onClick={createTestIssue}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform hover:scale-105"
                  >
                    Test DB Connection
                  </button>
                  <button
                    onClick={() => router.push('/super-admin')}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-red-600 dark:text-red-400 font-semibold">Open Issues</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {issues.filter(i => i.status === 'open').length}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="text-yellow-600 dark:text-yellow-400 font-semibold">In Progress</div>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    {issues.filter(i => i.status === 'in_progress').length}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-green-600 dark:text-green-400 font-semibold">Resolved</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {issues.filter(i => i.status === 'resolved').length}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">Total</div>
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {issues.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Issues List */}
          <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">All Issues</h2>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-600 dark:text-gray-400">Loading issues...</div>
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Issues Found</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first issue to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Title</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Severity</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Created</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((issue) => (
                        <tr key={issue.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{issue.title}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{issue.user_email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                              {issue.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(issue.severity)}`}>
                              {issue.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                              {issue.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(issue.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedIssue(issue)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                View
                              </button>
                              {issue.status === 'open' && (
                                <button
                                  onClick={() => updateIssueStatus(issue.id, 'in_progress')}
                                  className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                                >
                                  Start
                                </button>
                              )}
                              {issue.status === 'in_progress' && (
                                <button
                                  onClick={() => updateIssueStatus(issue.id, 'resolved')}
                                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Issue Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Issue</h2>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter issue title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Describe the issue in detail"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Severity
                      </label>
                      <select
                        name="severity"
                        value={formData.severity}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Category
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="bug">Bug</option>
                        <option value="feature">Feature</option>
                        <option value="improvement">Improvement</option>
                        <option value="ui">UI</option>
                        <option value="performance">Performance</option>
                        <option value="security">Security</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="user_email"
                      value={formData.user_email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page URL
                    </label>
                    <input
                      type="url"
                      name="page_url"
                      value={formData.page_url}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="https://example.com/page"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Screenshot (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {screenshotPreview && (
                      <div className="mt-2">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="max-w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createIssue}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200"
                  >
                    Create Issue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Issue Detail Modal */}
        {selectedIssue && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedIssue.title}</h2>
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getSeverityColor(selectedIssue.severity)}`}>
                      {selectedIssue.severity}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedIssue.status)}`}>
                      {selectedIssue.status.replace('_', ' ')}
                    </span>
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400">
                      {selectedIssue.category}
                    </span>
                  </div>

                  {selectedIssue.description && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                      <p className="text-gray-700 dark:text-gray-300">{selectedIssue.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Details</h3>
                      <div className="space-y-1 text-sm">
                        <div><strong>Email:</strong> {selectedIssue.user_email}</div>
                        <div><strong>Created:</strong> {new Date(selectedIssue.created_at).toLocaleString()}</div>
                        <div><strong>Updated:</strong> {new Date(selectedIssue.updated_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Page</h3>
                      <div className="space-y-1 text-sm">
                        <div><strong>URL:</strong> {selectedIssue.page_url}</div>
                      </div>
                    </div>
                  </div>

                  {selectedIssue.screenshot_url && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Screenshot</h3>
                      <img
                        src={selectedIssue.screenshot_url}
                        alt="Issue screenshot"
                        className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}

                  {selectedIssue.browser_info && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Browser Info</h3>
                      <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedIssue.browser_info), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  {selectedIssue.status === 'open' && (
                    <button
                      onClick={() => {
                        updateIssueStatus(selectedIssue.id, 'in_progress');
                        setSelectedIssue(null);
                      }}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all duration-200"
                    >
                      Start Working
                    </button>
                  )}
                  {selectedIssue.status === 'in_progress' && (
                    <button
                      onClick={() => {
                        updateIssueStatus(selectedIssue.id, 'resolved');
                        setSelectedIssue(null);
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200"
                    >
                      Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedIssue(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
