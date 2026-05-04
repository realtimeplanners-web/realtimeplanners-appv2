"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { handleLogout } from "../lib/auth";
import { useSearchParams, useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  role: string;
  organization_id?: string;
  created_at: string;
  user_name: string;
  organizations?: {
    organization_name: string;
  };
}

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
  const [navigationState, setNavigationState] = useState<{
    mainTab: string;
    subTab: string | null;
    selectedItem: any;
    breadcrumb: Array<{ label: string; id: string }>;
  }>({
    mainTab: "dashboard",
    subTab: null,
    selectedItem: null,
    breadcrumb: []
  });
  
  // Users management state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  
  // Project editing state
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editProjectForm, setEditProjectForm] = useState({
    project_name: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'Active'
  });
  const [editProjectErrors, setEditProjectErrors] = useState<Partial<typeof editProjectForm>>({});
  const [editProjectSubmitting, setEditProjectSubmitting] = useState(false);

  // User management modal state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Project Dashboard modal state
  const [showProjectDashboardModal, setShowProjectDashboardModal] = useState(false);
  
  // Add Activity modal state
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_name: '',
    planned_start: '',
    planned_end: '',
    duration_days: '',
    zone_id: '',
    task_id: ''
  });
  const [activityFormErrors, setActivityFormErrors] = useState<Partial<typeof activityForm>>({});
  const [activityFormSubmitting, setActivityFormSubmitting] = useState(false);

  // Create Project modal state
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [createProjectForm, setCreateProjectForm] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'Active'
  });
  const [createProjectErrors, setCreateProjectErrors] = useState<Partial<typeof createProjectForm>>({});
  const [createProjectSubmitting, setCreateProjectSubmitting] = useState(false);

  // Activity Details modal state
  const [showActivityDetailsModal, setShowActivityDetailsModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    user_name: '',
    role: 'user'
  });
  const [userFormErrors, setUserFormErrors] = useState({
    email: '',
    password: '',
    user_name: ''
  });

  // Activities state
  const [activities, setActivities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [activitiesLoading, setActivitiesLoading] = useState(false);

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

  // PROTECT ORG-DASHBOARD PAGE - Authentication and Role Check
  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log('Checking org dashboard authentication...');
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error('No authenticated user found:', authError);
          window.location.href = "/";
          return;
        }
        
        console.log('User authenticated:', user.id);
        
        // Get user info including role from public.users table
        const { data: userInfo, error: userError } = await supabase
          .from("users")
          .select("role, organization_id")
          .eq("id", user.id)
          .single();

        if (userError || !userInfo) {
          console.error("Error fetching user info:", userError);
          window.location.href = "/";
          return;
        }
        
        // Check if user has org_admin role (or super_admin for access)
        if (userInfo.role !== "org_admin" && userInfo.role !== "super_admin") {
          console.error(`Access denied: User role is ${userInfo.role}, required org_admin or super_admin`);
          window.location.href = "/";
          return;
        }
        
        console.log('Org admin authentication confirmed, role:', userInfo.role);
        
        // Set user data for the page
        setUserData(userInfo);

        // Get organization name
        const { data: orgData } = await supabase
          .from("organizations")
          .select("organization_name")
          .eq("id", userInfo.organization_id)
          .single();

        setOrgName(orgData?.organization_name || "Unknown Organization");
        setUserData(userInfo);
        
        // Fetch projects for this organization
        await fetchProjects(userInfo.organization_id);
        
      } catch (error) {
        console.error('Exception during authentication check:', error);
        window.location.href = "/";
      }
    };
    
    checkAccess();
  }, []);

  // Fetch projects for the organization
  const fetchProjects = async (organizationId: string) => {
    try {
      console.log('Fetching projects for organization:', organizationId);
      
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        setProjects([]);
      } else {
        console.log('Projects fetched:', projectsData?.length || 0);
        setProjects(projectsData || []);
      }
    } catch (error) {
      console.error('Exception fetching projects:', error);
      setProjects([]);
    }
  };

  // Navigation functions for single-page app
  const navigateTo = (mainTab: string, subTab?: string, selectedItem?: any) => {
    const newBreadcrumb = [];
    
    if (mainTab !== "dashboard") {
      newBreadcrumb.push({ label: mainTab.charAt(0).toUpperCase() + mainTab.slice(1), id: mainTab });
    }
    
    if (subTab) {
      newBreadcrumb.push({ label: subTab.charAt(0).toUpperCase() + subTab.slice(1), id: subTab });
    }
    
    if (selectedItem && selectedItem.name) {
      newBreadcrumb.push({ label: selectedItem.name, id: selectedItem.id });
    }

    setNavigationState({
      mainTab,
      subTab: subTab || null,
      selectedItem,
      breadcrumb: newBreadcrumb
    });
    
    setActiveTab(mainTab);
  };

  const navigateBack = () => {
    if (navigationState.subTab) {
      // Go back to main tab
      navigateTo(navigationState.mainTab);
    } else if (navigationState.mainTab !== "dashboard") {
      // Go back to dashboard
      navigateTo("dashboard");
    }
  };

  // Activities management functions
  const fetchZones = async (projectId: string) => {
    try {
      if (!projectId) {
        setZones([]);
        return;
      }

      const { data, error } = await supabase
        .from("zones")
        .select("id, project_id, zone_name, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching zones:", error);
        setZones([]);
      } else {
        setZones(data || []);
        if (data && data.length > 0 && !selectedZone) {
          setSelectedZone(data[0].id);
        }
      }
    } catch (err) {
      console.error("Exception fetching zones:", err);
      setZones([]);
    };
  };

  const fetchTasks = async () => {
    if (!navigationState.selectedItem?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, project_id, parent_id, level, wbs_code, task_name")
        .eq("project_id", navigationState.selectedItem.id)
        .order("wbs_code");

      if (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
      } else {
        setTasks(data || []);
      }
    } catch (err) {
      console.error("Exception fetching tasks:", err);
      setTasks([]);
    }
  };

  const fetchActivities = async () => {
    if (!selectedZone) return;
    
    setActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from("activities")
        .select("id, project_id, zone_id, activity_name, planned_start, planned_end, duration_days, status, created_at, updated_at, actual_start, actual_end")
        .eq("zone_id", selectedZone)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching activities:", error);
        setActivities([]);
      } else {
        setActivities(data || []);
      }
    } catch (err) {
      console.error("Exception fetching activities:", err);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Activity form handling functions
  const handleAddActivityClick = () => {
    setActivityForm({
      activity_name: '',
      planned_start: '',
      planned_end: '',
      duration_days: '',
      zone_id: selectedZone,
      task_id: ''
    });
    setActivityFormErrors({});
    setShowAddActivityModal(true);
  };

  const handleActivityClick = (activity: any) => {
    setSelectedActivity(activity);
    setShowActivityDetailsModal(true);
  };

  const handleEditActivity = (activity: any) => {
    // Close details modal and open add modal with pre-filled data
    setShowActivityDetailsModal(false);
    setActivityForm({
      activity_name: activity.activity_name,
      planned_start: activity.planned_start,
      planned_end: activity.planned_end,
      duration_days: activity.duration_days.toString(),
      zone_id: activity.zone_id,
      task_id: activity.task_id || ''
    });
    setActivityFormErrors({});
    setShowAddActivityModal(true);
  };

  const calculateProgress = (activity: any) => {
    // Calculate progress based on activity status and dates from activities table
    if (activity.status === 'completed') return 100;
    
    if (activity.status === 'not_started' || activity.status === 'pending') {
      return 0; // Return 0% for not started activities
    }
    
    // Only calculate date-based progress for in_progress activities
    const startDate = new Date(activity.planned_start);
    const endDate = new Date(activity.planned_end);
    const today = new Date();
    
    if (today < startDate) return 0;
    if (today > endDate) return 100;
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
  };

  const handleActivityInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setActivityForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (activityFormErrors[name as keyof typeof activityFormErrors]) {
      setActivityFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateActivityForm = () => {
    const errors: Partial<typeof activityForm> = {};
    
    if (!activityForm.activity_name.trim()) {
      errors.activity_name = 'Activity name is required';
    }
    
    if (!activityForm.zone_id) {
      errors.zone_id = 'Zone is required';
    }
    
    if (!activityForm.planned_start) {
      errors.planned_start = 'Start date is required';
    }
    
    if (!activityForm.planned_end) {
      errors.planned_end = 'End date is required';
    }
    
    if (activityForm.planned_start && activityForm.planned_end) {
      const startDate = new Date(activityForm.planned_start);
      const endDate = new Date(activityForm.planned_end);
      if (endDate <= startDate) {
        errors.planned_end = 'End date must be after start date';
      }
    }
    
    if (!activityForm.duration_days || parseInt(activityForm.duration_days) <= 0) {
      errors.duration_days = 'Duration must be greater than 0';
    }
    
    setActivityFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateActivityForm()) {
      return;
    }
    
    setActivityFormSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert([{
          activity_name: activityForm.activity_name,
          project_id: navigationState.selectedItem?.id,
          zone_id: activityForm.zone_id,
          task_id: activityForm.task_id || null,
          planned_start: activityForm.planned_start,
          planned_end: activityForm.planned_end,
          duration_days: parseInt(activityForm.duration_days),
          status: 'Pending'
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating activity:', error);
        setActivityFormErrors({ activity_name: 'Failed to create activity' });
      } else {
        // Refresh activities list
        await fetchActivities();
        setShowAddActivityModal(false);
        setActivityForm({
          activity_name: '',
          planned_start: '',
          planned_end: '',
          duration_days: '',
          zone_id: ''
        });
      }
    } catch (err) {
      console.error('Exception creating activity:', err);
      setActivityFormErrors({ activity_name: 'An unexpected error occurred' });
    } finally {
      setActivityFormSubmitting(false);
    }
  };

  // Create Project form handling functions
  const handleCreateProjectClick = () => {
    setCreateProjectForm({
      name: '',
      location: '',
      start_date: '',
      end_date: '',
      status: 'Active'
    });
    setCreateProjectErrors({});
    setShowCreateProjectModal(true);
  };

  const handleCreateProjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCreateProjectForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (createProjectErrors[name as keyof typeof createProjectForm]) {
      setCreateProjectErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateCreateProjectForm = (): boolean => {
    const errors: Partial<typeof createProjectForm> = {};

    if (!createProjectForm.name.trim()) {
      errors.name = 'Project name is required';
    }

    if (!createProjectForm.location.trim()) {
      errors.location = 'Location is required';
    }

    if (!createProjectForm.start_date) {
      errors.start_date = 'Start date is required';
    }

    if (!createProjectForm.end_date) {
      errors.end_date = 'End date is required';
    }

    if (createProjectForm.start_date && createProjectForm.end_date && createProjectForm.start_date > createProjectForm.end_date) {
      errors.end_date = 'End date must be after start date';
    }

    setCreateProjectErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCreateProjectForm()) {
      return;
    }

    setCreateProjectSubmitting(true);

    try {
      // Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Please log in to create a project');
        return;
      }

      // Fetch user from public.users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user:', userError);
        alert('Error: User not found');
        return;
      }

      // Prepare project data
      const projectData = {
        project_name: createProjectForm.name.trim(),
        location: createProjectForm.location.trim(),
        start_date: createProjectForm.start_date,
        end_date: createProjectForm.end_date,
        organization_id: userData.organization_id,
        status: createProjectForm.status,
        created_by: userData.id,
      };

      // Insert project
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        alert('Error creating project: ' + error.message);
        return;
      }

      console.log('Project created successfully:', data);
      alert('Project created successfully!');
      
      // Close modal and refresh projects
      setShowCreateProjectModal(false);
      fetchProjects();
      
    } catch (err) {
      console.error('Exception creating project:', err);
      setCreateProjectErrors({ name: 'An unexpected error occurred' });
    } finally {
      setCreateProjectSubmitting(false);
    }
  };

  // Reset zones and activities when project changes
  useEffect(() => {
    if (navigationState.mainTab === "projects" && navigationState.subTab === "activities" && navigationState.selectedItem) {
      fetchZones(navigationState.selectedItem.id);
      fetchTasks();
      setSelectedZone("");
      setActivities([]);
    }
  }, [navigationState.selectedItem, navigationState.subTab]);

  // Fetch activities when zone changes
  useEffect(() => {
    if (selectedZone && navigationState.mainTab === "projects" && navigationState.subTab === "activities") {
      fetchActivities();
    }
  }, [selectedZone, navigationState.subTab]);

  // Handle ESC key and Enter key navigation for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showActivityDetailsModal) {
          setShowActivityDetailsModal(false);
        }
        if (showAddActivityModal) {
          setShowAddActivityModal(false);
        }
        if (showCreateProjectModal) {
          setShowCreateProjectModal(false);
        }
      }
      
      // Handle Enter key for form navigation in Add Activity modal
      if (e.key === 'Enter' && showAddActivityModal) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
          const form = activeElement.closest('form');
          if (form) {
            const inputs = Array.from(form.querySelectorAll('input, select, button[type="submit"]'));
            const currentIndex = inputs.indexOf(activeElement);
            
            if (currentIndex < inputs.length - 1) {
              e.preventDefault();
              const nextInput = inputs[currentIndex + 1];
              if (nextInput) {
                nextInput.focus();
              }
            }
          }
        }
      }
      
      // Handle Enter key for form navigation in Create Project modal
      if (e.key === 'Enter' && showCreateProjectModal) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
          const form = activeElement.closest('form');
          if (form) {
            const inputs = Array.from(form.querySelectorAll('input, select, button[type="submit"]'));
            const currentIndex = inputs.indexOf(activeElement);
            
            if (currentIndex < inputs.length - 1) {
              e.preventDefault();
              const nextInput = inputs[currentIndex + 1];
              if (nextInput) {
                nextInput.focus();
              }
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showActivityDetailsModal, showAddActivityModal, showCreateProjectModal]);

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
        return;
      }

      // Refresh projects list
      if (userData?.organization_id) {
        await fetchProjects(userData.organization_id);
      }

      // Reset navigation if we were viewing the deleted project
      if (navigationState.selectedItem?.id === projectId) {
        setNavigationState({
          mainTab: "projects",
          subTab: null,
          selectedItem: null,
          breadcrumb: []
        });
      }
    } catch (error) {
      console.error('Exception deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setEditProjectForm({
      project_name: project.project_name,
      location: project.location,
      start_date: project.start_date,
      end_date: project.end_date,
      status: project.status
    });
    setEditProjectErrors({});
  };

  const handleEditProjectInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditProjectForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (editProjectErrors[name as keyof typeof editProjectErrors]) {
      setEditProjectErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateEditProjectForm = (): boolean => {
    const newErrors: Partial<typeof editProjectForm> = {};

    if (!editProjectForm.project_name.trim()) {
      newErrors.project_name = "Project name is required";
    }

    if (!editProjectForm.location.trim()) {
      newErrors.location = "Location is required";
    }

    if (!editProjectForm.start_date) {
      newErrors.start_date = "Start date is required";
    }

    if (!editProjectForm.end_date) {
      newErrors.end_date = "End date is required";
    }

    if (editProjectForm.start_date && editProjectForm.end_date) {
      const startDate = new Date(editProjectForm.start_date);
      const endDate = new Date(editProjectForm.end_date);
      if (endDate < startDate) {
        newErrors.end_date = "End date cannot be before start date";
      }
    }

    setEditProjectErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEditProjectForm()) {
      return;
    }

    setEditProjectSubmitting(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          project_name: editProjectForm.project_name,
          location: editProjectForm.location,
          start_date: editProjectForm.start_date,
          end_date: editProjectForm.end_date,
          status: editProjectForm.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProject.id);

      if (error) {
        console.error('Error updating project:', error);
        alert('Failed to update project');
        return;
      }

      // Refresh projects list
      if (userData?.organization_id) {
        await fetchProjects(userData.organization_id);
      }

      // Update selected project if it's the one being edited
      if (navigationState.selectedItem?.id === editingProject.id) {
        setNavigationState(prev => ({
          ...prev,
          selectedItem: {
            ...prev.selectedItem,
            project_name: editProjectForm.project_name,
            location: editProjectForm.location,
            start_date: editProjectForm.start_date,
            end_date: editProjectForm.end_date,
            status: editProjectForm.status,
          }
        }));
      }

      // Close edit form
      setEditingProject(null);
      
      alert('Project updated successfully!');
    } catch (error) {
      console.error('Exception updating project:', error);
      alert('Failed to update project');
    } finally {
      setEditProjectSubmitting(false);
    }
  };

  // User management modal functions
  const handleCreateUserClick = () => {
    setUserFormData({
      email: '',
      password: '',
      user_name: '',
      role: 'user'
    });
    setUserFormErrors({
      email: '',
      password: '',
      user_name: ''
    });
    setShowCreateUserModal(true);
  };

  const handleEditUserClick = (user: any) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      password: '',
      user_name: user.user_name,
      role: user.role
    });
    setUserFormErrors({
      email: '',
      password: '',
      user_name: ''
    });
    setShowEditUserModal(true);
  };

  const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (userFormErrors[name as keyof typeof userFormErrors]) {
      setUserFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateUserForm = (isEdit: boolean = false): boolean => {
    const errors = {
      email: '',
      password: '',
      user_name: ''
    };

    if (!userFormData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(userFormData.email)) {
      errors.email = 'Email is invalid';
    }

    if (!isEdit && !userFormData.password.trim()) {
      errors.password = 'Password is required';
    } else if (!isEdit && userFormData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!userFormData.user_name.trim()) {
      errors.user_name = 'Name is required';
    }

    setUserFormErrors(errors);
    return !errors.email && !errors.password && !errors.user_name;
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUserForm(false)) {
      return;
    }

    setUserFormSubmitting(true);

    try {
      // Create auth user using signup method
      const { data, error: authError } = await supabase.auth.signUp({
        email: userFormData.email,
        password: userFormData.password,
        options: {
          data: {
            user_name: userFormData.user_name,
            role: userFormData.role,
            organization_id: userData?.organization_id
          }
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        alert('Failed to create user: ' + authError.message);
        return;
      }

      if (!data.user) {
        console.error('No user data returned from signup');
        alert('Failed to create user: No user data returned');
        return;
      }

      // Insert user data into public.users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: userFormData.email,
          user_name: userFormData.user_name,
          role: userFormData.role,
          organization_id: userData?.organization_id
        });

      if (userError) {
        console.error('Error inserting user:', userError);
        alert('Failed to create user: ' + userError.message);
      } else {
        alert('User created successfully!');
        await fetchUsers();
        setShowCreateUserModal(false);
      }
    } catch (err) {
      console.error('Error creating user:', err);
      alert('Failed to create user');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUserForm(true)) {
      return;
    }

    setUserFormSubmitting(true);

    try {
      const updateData: any = {
        user_name: userFormData.user_name,
        role: userFormData.role
      };

      // Only update password if provided
      if (userFormData.password.trim()) {
        // Update auth user password
        const { error: authError } = await supabase.auth.updateUser({
          password: userFormData.password
        });

        if (authError) {
          console.error('Error updating auth user password:', authError);
          alert('Failed to update password: ' + authError.message);
          return;
        }
      }

      // Update user data in public.users table
      const { error: userError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingUser.id);

      if (userError) {
        console.error('Error updating user:', userError);
        alert('Failed to update user: ' + userError.message);
      } else {
        alert('User updated successfully!');
        await fetchUsers();
        setShowEditUserModal(false);
        setEditingUser(null);
      }
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  // Users management functions
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      
      // Fetch users first
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, role, organization_id, user_name, email, created_at')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        setUsersError('Failed to fetch users');
        return;
      }

      // Fetch organizations separately
      const orgIds = [...new Set(usersData?.map(user => user.organization_id).filter(Boolean) || [])];
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, organization_name')
        .in('id', orgIds);

      if (orgsError) {
        console.error('Error fetching organizations:', orgsError);
      }

      // Create a map of organization ID to name
      const orgMap = (orgsData || []).reduce((acc, org) => {
        acc[org.id] = org.organization_name;
        return acc;
      }, {} as Record<string, string>);

      // Combine users with organization names
      const usersWithOrgs = (usersData || []).map(user => ({
        ...user,
        organizations: {
          organization_name: orgMap[user.organization_id || ''] || '-'
        }
      }));

      setUsers(usersWithOrgs);
    } catch (err) {
      console.error('Exception fetching users:', err);
      setUsersError('An unexpected error occurred');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (userData: { email: string; password: string; user_name: string; organization_id?: string }) => {
    try {
      // Create auth user using signup method
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            user_name: userData.user_name,
          }
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        alert('Failed to create user: ' + authError.message);
        return;
      }

      if (!authData.user) {
        console.error('No user data returned from signup');
        alert('Failed to create user: No user data returned');
        return;
      }

      // Insert into public.users
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          user_name: userData.user_name,
          email: userData.email,
          role: 'user',
          organization_id: userData.organization_id || null
        })
        .select()
        .single();

      if (userError) {
        console.error('Error inserting user:', userError);
        alert('Failed to create user: ' + userError.message);
      } else {
        alert('User created successfully!');
        await fetchUsers();
      }
    } catch (err) {
      console.error('Exception creating user:', err);
      alert('An unexpected error occurred while creating the user.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) {
          console.error('Error deleting user:', error);
          alert('Failed to delete user: ' + error.message);
        } else {
          alert('User deleted successfully!');
          await fetchUsers();
        }
      } catch (err) {
        console.error('Exception deleting user:', err);
        alert('An unexpected error occurred while deleting the user.');
      }
    }
  };

  // Fetch users when users tab is activated
  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
      fetchUsers();
    }
  }, [activeTab]);

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
              { id: "planning", label: "WBS Planning", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
              { id: "project-dashboard", label: "Project Dashboard", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
              { id: "projects-list", label: "Project activities", icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-4 0v8a2 2 0 104 0V6z" },
              { id: "users", label: "Manage Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
              { id: "reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "project-dashboard") {
                    setShowProjectDashboardModal(true);
                  } else if (item.id === "projects") {
                    navigateTo("projects");
                  } else if (item.id === "planning") {
                    router.push('/planning');
                  } else if (item.id === "projects-list") {
                    router.push('/projects-list');
                  } else {
                    navigateTo(item.id);
                  }
                }}
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
              onClick={handleLogout}
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
                  {/* Breadcrumb Navigation */}
                  {navigationState.breadcrumb.length > 0 && (
                    <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <button
                        onClick={() => navigateTo("dashboard")}
                        className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        Dashboard
                      </button>
                      {navigationState.breadcrumb.map((crumb, index) => (
                        <div key={crumb.id} className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {index === navigationState.breadcrumb.length - 1 ? (
                            <span className="text-gray-900 dark:text-white font-medium">{crumb.label}</span>
                          ) : (
                            <button
                              onClick={() => {
                                if (index === 0) {
                                  navigateTo(crumb.id);
                                } else {
                                  navigateTo(navigationState.mainTab, crumb.id);
                                }
                              }}
                              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                              {crumb.label}
                            </button>
                          )}
                        </div>
                      ))}
                    </nav>
                  )}
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {navigationState.mainTab === "dashboard" && "Dashboard"}
                    {navigationState.mainTab === "projects" && navigationState.subTab === "dashboard" && "Project Dashboard"}
                    {navigationState.mainTab === "projects" && !navigationState.subTab && "Projects"}
                    {navigationState.mainTab === "users" && "Manage Users"}
                    {navigationState.mainTab === "reports" && "Reports"}
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
                      onClick={handleCreateProjectClick}
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
                          onClick={handleCreateProjectClick}
                          className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          Create Your First Project
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {projects.map((project) => (
                          <div key={project.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-102 cursor-pointer"
                               onClick={() => router.push(`/projects-list?project_id=${project.id}`)}>
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white">{project.project_name}</h4>
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

            {navigationState.mainTab === "projects" && navigationState.subTab === "dashboard" && (
              <div className="space-y-6">
                {/* Project Dashboard Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 p-4 md:p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/50">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <h3 className="text-sm md:text-lg font-semibold text-blue-900 dark:text-blue-100">Total Projects</h3>
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">{projects.length}</p>
                    <p className="text-xs md:text-sm text-blue-700 dark:text-blue-300">Active projects</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 p-4 md:p-6 rounded-2xl border border-green-200/50 dark:border-green-800/50">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <h3 className="text-sm md:text-lg font-semibold text-green-900 dark:text-green-100">Completed</h3>
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100">
                      {projects.filter(p => p.status === 'Completed').length}
                    </p>
                    <p className="text-xs md:text-sm text-green-700 dark:text-green-300">Completed projects</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 dark:from-yellow-500/20 dark:to-yellow-600/20 p-4 md:p-6 rounded-2xl border border-yellow-200/50 dark:border-yellow-800/50">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <h3 className="text-sm md:text-lg font-semibold text-yellow-900 dark:text-yellow-100">In Progress</h3>
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                      {projects.filter(p => p.status === 'Active').length}
                    </p>
                    <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-300">Active projects</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 p-4 md:p-6 rounded-2xl border border-purple-200/50 dark:border-purple-800/50">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <h3 className="text-sm md:text-lg font-semibold text-purple-900 dark:text-purple-100">Total Users</h3>
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-purple-900 dark:text-purple-100">{users.length}</p>
                    <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300">Organization users</p>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="p-4 sm:p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Recent Projects</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Latest project activity</p>
                  </div>
                  <div className="p-4 sm:p-6">
                    {projects.length === 0 ? (
                      <div className="text-center py-8 sm:py-12">
                        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">No projects yet</p>
                        <button 
                          onClick={() => navigateTo("projects")}
                          className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          Create Your First Project
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        {projects.slice(0, 5).map((project) => (
                          <div key={project.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 sm:p-4 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-102 cursor-pointer"
                               onClick={() => navigateTo("projects", "details", project)}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">{project.project_name}</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    {project.location || 'No location'}
                                  </p>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    project.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                    project.status === 'Active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                                  }`}>
                                    {project.status || 'Active'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                                  {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(project.created_at).toLocaleDateString()}
                                </span>
                                <svg className="w-4 h-4 text-gray-400 ml-2 sm:ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {navigationState.mainTab === "projects" && navigationState.subTab !== "details" && navigationState.subTab !== "dashboard" && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="p-4 sm:p-6 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">All Projects</h3>
                  <button 
                    onClick={handleCreateProjectClick}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors w-full sm:w-auto"
                  >
                    Create Project
                  </button>
                </div>
                <div className="p-4 sm:p-6">
                  {projects.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <p className="text-gray-500 dark:text-gray-400">No projects found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {projects.map((project) => (
                        <div key={project.id} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                             onClick={() => navigateTo("projects", "details", project)}>
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                          <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white mb-2 truncate">{project.project_name}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 truncate">{project.location || 'No location specified'}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span className="hidden sm:inline">Created: {new Date(project.created_at).toLocaleDateString()}</span>
                            <span className="sm:hidden">{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {navigationState.mainTab === "projects" && navigationState.subTab === "details" && navigationState.selectedItem && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{navigationState.selectedItem.project_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{navigationState.selectedItem.location}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigateTo("projects")}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        Back to Projects
                      </button>
                      <button
                        onClick={() => navigateTo("projects", "activities", navigationState.selectedItem)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        View Activities
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Project Details</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Start Date:</span> {new Date(navigationState.selectedItem.start_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">End Date:</span> {new Date(navigationState.selectedItem.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Created:</span> {new Date(navigationState.selectedItem.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Quick Actions</h4>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleEditProject(navigationState.selectedItem)}
                          className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                        >
                          Edit Project
                        </button>
                        <button 
                          onClick={() => handleDeleteProject(navigationState.selectedItem?.id, navigationState.selectedItem?.project_name)}
                          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          Delete Project
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {navigationState.mainTab === "users" && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Manage Users</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage organization users
                      </p>
                    </div>
                    <button
                      onClick={handleCreateUserClick}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Create User
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {usersLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  ) : usersError ? (
                    <div className="text-center py-12">
                      <div className="text-red-600 dark:text-red-400 text-lg font-medium mb-4">
                        {usersError}
                      </div>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-4">
                        No users found
                      </div>
                      <button
                        onClick={handleCreateUserClick}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Create First User
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200/50 dark:border-gray-700/50">
                            <th className="pb-3">Name</th>
                            <th className="pb-3">Email</th>
                            <th className="pb-3">Role</th>
                            <th className="pb-3">Organization</th>
                            <th className="pb-3">Created</th>
                            <th className="pb-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {users.map((user) => (
                            <tr key={user.id} className="border-b border-gray-100/50 dark:border-gray-800/50">
                              <td className="py-4 font-medium text-gray-900 dark:text-white">
                                {user.user_name}
                              </td>
                              <td className="py-4 text-gray-600 dark:text-gray-400">
                                {user.email}
                              </td>
                              <td className="py-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  user.role === 'org_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' :
                                  user.role === 'super_admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                  'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="py-4 text-gray-600 dark:text-gray-400">
                                {user.organizations?.organization_name || '-'}
                              </td>
                              <td className="py-4 text-gray-600 dark:text-gray-400">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditUserClick(user)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id, user.user_name)}
                                    className="text-red-600 dark:text-red-400 hover:text-red-800 font-medium"
                                  >
                                    Delete
                                  </button>
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
            )}

            {navigationState.mainTab === "projects" && navigationState.subTab === "activities" && navigationState.selectedItem && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Activities - {navigationState.selectedItem.project_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Manage project activities and progress</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigateTo("projects", "details", navigationState.selectedItem)}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        Back to Project
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Zone Selector */}
                <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="max-w-md">
                    <label htmlFor="zone-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Zone
                    </label>
                    <select
                      id="zone-select"
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Select a zone...</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.zone_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Activities List */}
                <div className="p-6">
                  {!selectedZone ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a Zone</h3>
                      <p className="text-gray-500 dark:text-gray-400">Please select a zone to view activities</p>
                    </div>
                  ) : activitiesLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Activities Yet</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No activities found for this zone</p>
                      {(userData?.role === 'super_admin' || userData?.role === 'org_admin') && (
                        <button onClick={handleAddActivityClick} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                          Add First Activity
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <div 
                          key={activity.id} 
                          className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-102"
                          onClick={() => handleActivityClick(activity)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{activity.activity_name}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(activity.planned_start).toLocaleDateString()} - {new Date(activity.planned_end).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                activity.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                activity.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                              }`}>
                                {activity.status?.replace('_', ' ') || 'Not Started'}
                              </span>
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
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

        {/* Inline Project Edit Modal */}
        {editingProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Project</h2>
                <button
                  onClick={() => setEditingProject(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateProject} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    name="project_name"
                    value={editProjectForm.project_name}
                    onChange={handleEditProjectInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      editProjectErrors.project_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter project name"
                  />
                  {editProjectErrors.project_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editProjectErrors.project_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={editProjectForm.location}
                    onChange={handleEditProjectInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      editProjectErrors.location ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter project location"
                  />
                  {editProjectErrors.location && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editProjectErrors.location}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={editProjectForm.start_date}
                      onChange={handleEditProjectInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        editProjectErrors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    />
                    {editProjectErrors.start_date && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editProjectErrors.start_date}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={editProjectForm.end_date}
                      onChange={handleEditProjectInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        editProjectErrors.end_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    />
                    {editProjectErrors.end_date && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editProjectErrors.end_date}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={editProjectForm.status}
                    onChange={handleEditProjectInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editProjectSubmitting}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editProjectSubmitting ? 'Updating...' : 'Update Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create User Modal - Modal overlay with backdrop */}
        {showCreateUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h2>
                <button
                  onClick={() => {
                    setShowCreateUserModal(false);
                    setUserFormData({
                      email: '',
                      password: '',
                      user_name: '',
                      role: 'user'
                    });
                    setUserFormErrors({
                      email: '',
                      password: '',
                      user_name: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="user_name"
                    value={userFormData.user_name}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.user_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter user name"
                  />
                  {userFormErrors.user_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userFormErrors.user_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={userFormData.email}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter email address"
                  />
                  {userFormErrors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userFormErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={userFormData.password}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter password"
                  />
                  {userFormErrors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userFormErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    name="role"
                    value={userFormData.role}
                    onChange={handleUserInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="qc">QC</option>
                    <option value="maker">Maker</option>
                    <option value="checker">Checker</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateUserModal(false);
                      setUserFormData({
                        email: '',
                        password: '',
                        user_name: '',
                        role: 'user'
                      });
                      setUserFormErrors({
                        email: '',
                        password: '',
                        user_name: ''
                      });
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userFormSubmitting}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {userFormSubmitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal - Modal-Inline Form Pattern */}
        {showEditUserModal && editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit User</h2>
                <button
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                    setUserFormData({
                      email: '',
                      password: '',
                      user_name: '',
                      role: 'user'
                    });
                    setUserFormErrors({
                      email: '',
                      password: '',
                      user_name: ''
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="user_name"
                    value={userFormData.user_name}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.user_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter user name"
                  />
                  {userFormErrors.user_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userFormErrors.user_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={userFormData.email}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Enter email address"
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Password (optional)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={userFormData.password}
                    onChange={handleUserInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      userFormErrors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="Leave blank to keep current password"
                  />
                  {userFormErrors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userFormErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    name="role"
                    value={userFormData.role}
                    onChange={handleUserInputChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="qc">QC</option>
                    <option value="maker">Maker</option>
                    <option value="checker">Checker</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUserModal(false);
                      setEditingUser(null);
                      setUserFormData({
                        email: '',
                        password: '',
                        user_name: '',
                        role: 'user'
                      });
                      setUserFormErrors({
                        email: '',
                        password: '',
                        user_name: ''
                      });
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userFormSubmitting}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {userFormSubmitting ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Project Dashboard Modal - Modal overlay with backdrop */}
        {showProjectDashboardModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Project Dashboard</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of your projects and statistics</p>
                </div>
                <button
                  onClick={() => setShowProjectDashboardModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Project Dashboard Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 p-4 md:p-6 rounded-2xl border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h3 className="text-sm md:text-lg font-semibold text-blue-900 dark:text-blue-100">Total Projects</h3>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">{projects.length}</p>
                      <p className="text-xs md:text-sm text-blue-700 dark:text-blue-300">Active projects</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 p-4 md:p-6 rounded-2xl border border-green-200/50 dark:border-green-800/50">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h3 className="text-sm md:text-lg font-semibold text-green-900 dark:text-green-100">Completed</h3>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100">
                        {projects.filter(p => p.status === 'Completed').length}
                      </p>
                      <p className="text-xs md:text-sm text-green-700 dark:text-green-300">Completed projects</p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 dark:from-yellow-500/20 dark:to-yellow-600/20 p-4 md:p-6 rounded-2xl border border-yellow-200/50 dark:border-yellow-800/50">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h3 className="text-sm md:text-lg font-semibold text-yellow-900 dark:text-yellow-100">In Progress</h3>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                        {projects.filter(p => p.status === 'Active').length}
                      </p>
                      <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-300">Active projects</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 p-4 md:p-6 rounded-2xl border border-purple-200/50 dark:border-purple-800/50">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h3 className="text-sm md:text-lg font-semibold text-purple-900 dark:text-purple-100">Total Users</h3>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-purple-900 dark:text-purple-100">{users.length}</p>
                      <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300">Organization users</p>
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-600">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Recent Projects</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Latest project activity</p>
                    </div>
                    <div className="p-4 sm:p-6">
                      {projects.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                          <svg className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <p className="text-gray-500 dark:text-gray-400 mb-4">No projects yet</p>
                          <button 
                            onClick={() => {
                              setShowProjectDashboardModal(false);
                              navigateTo("projects");
                            }}
                            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          >
                            Create Your First Project
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-4">
                          {projects.slice(0, 5).map((project) => (
                            <div key={project.id} className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer"
                                 onClick={() => {
                                   setShowProjectDashboardModal(false);
                                   navigateTo("projects", "details", project);
                                 }}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">{project.project_name}</h4>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                      {project.location || 'No location'}
                                    </p>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      project.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                      project.status === 'Active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                                    }`}>
                                      {project.status || 'Active'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                                    {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(project.created_at).toLocaleDateString()}
                                  </span>
                                  <svg className="w-4 h-4 text-gray-400 ml-2 sm:ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-end">
                    <button
                      onClick={() => setShowProjectDashboardModal(false)}
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectDashboardModal(false);
                        navigateTo("projects");
                      }}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      View All Projects
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Activity Modal - Modal overlay with backdrop */}
        {showAddActivityModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddActivityModal(false)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Add New Activity</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a new activity for {navigationState.selectedItem?.project_name}</p>
                </div>
                <button
                  onClick={() => setShowAddActivityModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <form onSubmit={handleAddActivitySubmit} className="space-y-4">
                  {/* Activity Name */}
                  <div>
                    <label htmlFor="activity_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      id="activity_name"
                      name="activity_name"
                      value={activityForm.activity_name}
                      onChange={handleActivityInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        activityFormErrors.activity_name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter activity name"
                    />
                    {activityFormErrors.activity_name && (
                      <p className="mt-1 text-sm text-red-600">{activityFormErrors.activity_name}</p>
                    )}
                  </div>

                  {/* Zone Selection */}
                  <div>
                    <label htmlFor="zone_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Zone *
                    </label>
                    <select
                      id="zone_id"
                      name="zone_id"
                      value={activityForm.zone_id}
                      onChange={handleActivityInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        activityFormErrors.zone_id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a zone</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.zone_name}
                        </option>
                      ))}
                    </select>
                    {activityFormErrors.zone_id && (
                      <p className="mt-1 text-sm text-red-600">{activityFormErrors.zone_id}</p>
                    )}
                  </div>

                  {/* WBS Task Selection */}
                  <div>
                    <label htmlFor="task_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WBS Task (Optional)
                    </label>
                    <select
                      id="task_id"
                      name="task_id"
                      value={activityForm.task_id}
                      onChange={handleActivityInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        activityFormErrors.task_id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select WBS task (optional)</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {'  '.repeat(task.level || 0)}{task.wbs_code} - {task.task_name}
                        </option>
                      ))}
                    </select>
                    {activityFormErrors.task_id && (
                      <p className="mt-1 text-sm text-red-600">{activityFormErrors.task_id}</p>
                    )}
                  </div>

                  {/* Date Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="planned_start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        id="planned_start"
                        name="planned_start"
                        value={activityForm.planned_start}
                        onChange={handleActivityInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          activityFormErrors.planned_start ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {activityFormErrors.planned_start && (
                        <p className="mt-1 text-sm text-red-600">{activityFormErrors.planned_start}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="planned_end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        id="planned_end"
                        name="planned_end"
                        value={activityForm.planned_end}
                        onChange={handleActivityInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          activityFormErrors.planned_end ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {activityFormErrors.planned_end && (
                        <p className="mt-1 text-sm text-red-600">{activityFormErrors.planned_end}</p>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label htmlFor="duration_days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration (Days) *
                    </label>
                    <input
                      type="number"
                      id="duration_days"
                      name="duration_days"
                      value={activityForm.duration_days}
                      onChange={handleActivityInputChange}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        activityFormErrors.duration_days ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter duration in days"
                    />
                    {activityFormErrors.duration_days && (
                      <p className="mt-1 text-sm text-red-600">{activityFormErrors.duration_days}</p>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowAddActivityModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={activityFormSubmitting}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activityFormSubmitting ? 'Creating...' : 'Create Activity'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Activity Details Modal - Modal overlay with backdrop */}
        {showActivityDetailsModal && selectedActivity && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowActivityDetailsModal(false)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Activity Details</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedActivity.activity_name}</p>
                </div>
                <button
                  onClick={() => setShowActivityDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Progress Section */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 sm:p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Progress</h3>
                      <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {calculateProgress(selectedActivity)}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-700 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${calculateProgress(selectedActivity)}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                      {calculateProgress(selectedActivity)}% completed
                    </p>
                  </div>

                  {/* Activity Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h4>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        selectedActivity.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                        selectedActivity.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                      }`}>
                        {selectedActivity.status?.replace('_', ' ') || 'Not Started'}
                      </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duration</h4>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedActivity.duration_days} days
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</h4>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {new Date(selectedActivity.planned_start).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</h4>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {new Date(selectedActivity.planned_end).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Timeline Information */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Timeline Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Planned Start:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(selectedActivity.planned_start).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Planned End:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(selectedActivity.planned_end).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {selectedActivity.actual_start && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Actual Start:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(selectedActivity.actual_start).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {selectedActivity.actual_end && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Actual End:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(selectedActivity.actual_end).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Created/Updated Information */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Record Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(selectedActivity.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {selectedActivity.updated_at && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(selectedActivity.updated_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                                  </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Project Modal - Modal overlay with backdrop */}
        {showCreateProjectModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateProjectModal(false)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create New Project</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add a new project to your organization</p>
                </div>
                <button
                  onClick={() => setShowCreateProjectModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
                  {/* Project Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={createProjectForm.name}
                      onChange={handleCreateProjectChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        createProjectErrors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter project name"
                    />
                    {createProjectErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{createProjectErrors.name}</p>
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
                      value={createProjectForm.location}
                      onChange={handleCreateProjectChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        createProjectErrors.location ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter project location"
                    />
                    {createProjectErrors.location && (
                      <p className="mt-1 text-sm text-red-600">{createProjectErrors.location}</p>
                    )}
                  </div>

                  {/* Start Date */}
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={createProjectForm.start_date}
                      onChange={handleCreateProjectChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        createProjectErrors.start_date ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {createProjectErrors.start_date && (
                      <p className="mt-1 text-sm text-red-600">{createProjectErrors.start_date}</p>
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
                      value={createProjectForm.end_date}
                      onChange={handleCreateProjectChange}
                      min={createProjectForm.start_date}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        createProjectErrors.end_date ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {createProjectErrors.end_date && (
                      <p className="mt-1 text-sm text-red-600">{createProjectErrors.end_date}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={createProjectForm.status}
                      onChange={handleCreateProjectChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowCreateProjectModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createProjectSubmitting}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {createProjectSubmitting ? 'Creating...' : 'Create Project'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
