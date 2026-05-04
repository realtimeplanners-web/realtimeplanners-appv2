"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { handleLogout } from "../lib/auth";
import { useSearchParams, useRouter } from "next/navigation";
import PermissionsConsole from "../../features/permissions/components/PermissionsConsole";
import { permissionsService } from "../../features/permissions/service";
import type { Feature, PermissionCell, Role, RolePermission } from "../../features/permissions/types";

// Date formatting function
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Super Admin User Management Tab Component
function SuperAdminUserManagementTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    user_name: '',
    organization_id: '',
    role: 'user'
  });
  
  // Filter and sort state
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const router = useRouter();

  // PROTECT SUPER ADMIN PAGE - Authentication and Role Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking super admin authentication...');
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.error('No authenticated user found:', authError);
          window.location.href = "/";
          return;
        }
        
        console.log('User authenticated:', user.id);
        
        // Check if user has super_admin role
        const { data: userData, error: roleError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        
        if (roleError || !userData) {
          console.error('Error fetching user role:', roleError);
          window.location.href = "/";
          return;
        }
        
        if (userData.role !== "super_admin") {
          console.error(`Access denied: User role is ${userData.role}, required super_admin`);
          window.location.href = "/";
          return;
        }
        
        console.log('Super admin authentication confirmed');
        
        // Only fetch data if authentication passes
        fetchUsers();
        fetchCurrentUser();
        fetchOrganizations();
        
      } catch (error) {
        console.error('Exception during authentication check:', error);
        window.location.href = "/";
      }
    };
    
    checkAuth();
  }, []);

  // Filter and sort functions
  const getFilteredAndSortedUsers = () => {
    let filteredUsers = users;

    // Apply role filter
    if (roleFilter !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
    }

    // Apply organization filter
    if (organizationFilter !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.organization_id === organizationFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.user_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.role?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const sortedUsers = [...filteredUsers].sort((a, b) => {
      let aValue: any = a[sortBy as keyof typeof a];
      let bValue: any = b[sortBy as keyof typeof b];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Handle date sorting
      if (sortBy === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sortedUsers;
  };

  // Selection functions
  const handleUserSelection = (userId: string) => {
    const newSelectedUsers = new Set(selectedUsers);
    if (newSelectedUsers.has(userId)) {
      newSelectedUsers.delete(userId);
    } else {
      newSelectedUsers.add(userId);
    }
    setSelectedUsers(newSelectedUsers);
    setSelectAll(newSelectedUsers.size === getFilteredAndSortedUsers().length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers(new Set());
      setSelectAll(false);
    } else {
      const filteredUsers = getFilteredAndSortedUsers();
      const allUserIds = new Set(filteredUsers.map(user => user.id));
      setSelectedUsers(allUserIds);
      setSelectAll(true);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, organization_name')
        .order('organization_name');

      if (error) {
        console.error('Error fetching organizations:', error);
      } else {
        setOrganizations(data || []);
      }
    } catch (err) {
      console.error('Exception fetching organizations:', err);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, user_name, email, role, organization_id, created_at')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          setUserData(userData);
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle create user
  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.user_name) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create auth user using signup method
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            user_name: formData.user_name,
          }
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        setError('Failed to create user: ' + authError.message);
        return;
      }

      if (!authData.user) {
        console.error('No user data returned from signup');
        setError('Failed to create user: No user data returned');
        return;
      }

      // Insert into public.users
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          user_name: formData.user_name,
          email: formData.email,
          role: formData.role,
          organization_id: formData.organization_id || null
        })
        .select()
        .single();

      if (userError) {
        console.error('Error inserting user:', userError);
        setError('Failed to create user: ' + userError.message);
      } else {
        alert('User created successfully!');
        setShowCreateForm(false);
        setFormData({ email: '', password: '', user_name: '', organization_id: '', role: 'user' });
        await fetchUsers();
      }
    } catch (err) {
      console.error('Exception creating user:', err);
      setError('An unexpected error occurred while creating the user.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit user
  const handleEditUser = async (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      user_name: user.user_name,
      organization_id: user.organization_id || '',
      role: user.role
    });
    setShowCreateForm(true);
  };

  // Handle update user
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setSubmitting(true);
    setError(null);

    try {
      const updateData: any = {
        user_name: formData.user_name,
        role: formData.role,
        organization_id: formData.organization_id || null
      };

      // Update password if provided
      if (formData.password) {
        const { error: authError } = await supabase.auth.updateUser({
          password: formData.password
        });
        if (authError) {
          setError('Failed to update password: ' + authError.message);
          return;
        }
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', editingUser.id);

      if (error) {
        setError('Failed to update user: ' + error.message);
      } else {
        alert('User updated successfully!');
        setShowCreateForm(false);
        setEditingUser(null);
        setFormData({ email: '', password: '', user_name: '', organization_id: '', role: 'user' });
        await fetchUsers();
      }
    } catch (err) {
      console.error('Exception updating user:', err);
      setError('An unexpected error occurred while updating the user.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all users without role filter
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, role, organization_id, user_name, email, created_at')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        setError('Failed to fetch users');
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
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
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

  return (
    <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20">
      <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:via-blue-500/20 dark:to-purple-500/20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
            {userData && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Super Admin : {userData.email}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingUser(null);
              setFormData({ email: '', password: '', user_name: '', organization_id: '', role: 'user' });
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add User
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Create/Edit User Form */}
        {showCreateForm && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="user_name"
                  value={formData.user_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter user name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="user">User</option>
                  <option value="org_admin">Org Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700"
                  placeholder="Enter email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password {editingUser ? '(leave empty to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={editingUser ? 'Leave empty to keep current password' : 'Enter password'}
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization
                </label>
                <select
                  name="organization_id"
                  value={formData.organization_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select organization (optional)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.organization_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {submitting ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingUser(null);
                  setFormData({ email: '', password: '', user_name: '', organization_id: '', role: 'user' });
                  setError(null);
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-4">
              No users found
            </div>
          </div>
        ) : (
          <>
            {/* Filters Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or role..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                {/* Role Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="org_admin">Org Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                
                {/* Organization Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Organization
                  </label>
                  <select
                    value={organizationFilter}
                    onChange={(e) => setOrganizationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.organization_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setRoleFilter('all');
                      setOrganizationFilter('all');
                      setSearchTerm('');
                    }}
                    className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            {selectedUsers.size > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedUsers(new Set())}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleSort('user_name')}
                    >
                      <div className="flex items-center">
                        Name
                        {sortBy === 'user_name' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center">
                        Email
                        {sortBy === 'email' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleSort('role')}
                    >
                      <div className="flex items-center">
                        Role
                        {sortBy === 'role' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Organization
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Created
                        {sortBy === 'created_at' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getFilteredAndSortedUsers().map((user) => (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                        selectedUsers.has(user.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      }`}
                      onClick={() => handleUserSelection(user.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleUserSelection(user.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'org_admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {user.organizations?.organization_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium"
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
          </>
        )}
      </div>
    </div>
  );
}


export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [admins, setAdmins] = useState<any[]>([]);
  const [dark, setDark] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newProject, setNewProject] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectClient, setEditProjectClient] = useState("");
  const [editProjectLocation, setEditProjectLocation] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState("");
  const [editProjectStartDate, setEditProjectStartDate] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");
  const [orgSortField, setOrgSortField] = useState<"name" | "created_at">("created_at");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc">("desc");
  const [projectSortField, setProjectSortField] = useState<"name" | "created_at">("created_at");
  const [projectSortOrder, setProjectSortOrder] = useState<"asc" | "desc">("desc");
  const [orgFilter, setOrgFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [issues, setIssues] = useState<any[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<Role[]>([]);
  const [permissionFeatures, setPermissionFeatures] = useState<Feature[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, PermissionCell>>({});
  const [permissionSavingKey, setPermissionSavingKey] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [pdSelectedProject, setPdSelectedProject] = useState("");
  const [pdActivities, setPdActivities] = useState<any[]>([]);
  const [pdSummary, setPdSummary] = useState({ total: 0, completed: 0, inProgress: 0, notStarted: 0, delayed: 0 });
  const [pdLoading, setPdLoading] = useState(false);

  const toPermissionMatrix = (items: RolePermission[]): Record<string, PermissionCell> => {
    const out: Record<string, PermissionCell> = {};
    for (const item of items) {
      out[`${item.role_id}:${item.feature_id}`] = {
        roleId: item.role_id,
        featureId: item.feature_id,
        allowed: item.allowed,
        scope: item.scope,
        recordId: item.id,
      };
    }
    return out;
  };

  const loadPermissions = useCallback(async () => {
    try {
      setLoadingPermissions(true);
      setPermissionError(null);
      setPermissionStatus(null);
      const [rolesData, featuresData, permissionsData] = await Promise.all([
        permissionsService.fetchRoles(),
        permissionsService.fetchFeatures(),
        permissionsService.fetchRolePermissions(),
      ]);
      setPermissionRoles(rolesData);
      setPermissionFeatures(featuresData);
      setPermissionMatrix(toPermissionMatrix(permissionsData));
    } catch (e: any) {
      const message = String(e?.message || "");
      if (message.includes("relation") || message.includes("does not exist")) {
        setPermissionError(
          "Permissions tables are missing. Run migration: supabase/migrations/20260501_permissions_console_v1.sql"
        );
      } else {
        setPermissionError(message || "Failed to load permissions.");
      }
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  const upsertPermissionCell = async (
    roleId: string,
    featureId: string,
    patch: Partial<Pick<PermissionCell, "allowed" | "scope">>
  ) => {
    const key = `${roleId}:${featureId}`;
    const current = permissionMatrix[key] ?? {
      roleId,
      featureId,
      allowed: false,
      scope: "none" as const,
    };
    const next: PermissionCell = { ...current, ...patch };

    setPermissionSavingKey(key);
    setPermissionError(null);
    setPermissionMatrix((prev) => ({ ...prev, [key]: next }));
    try {
      await permissionsService.upsertRolePermission({
        role_id: roleId,
        feature_id: featureId,
        allowed: next.allowed,
        scope: next.allowed ? next.scope : "none",
      });
    } catch (e: any) {
      setPermissionError(e?.message || "Failed to update permission.");
      setPermissionMatrix((prev) => ({ ...prev, [key]: current }));
    } finally {
      setPermissionSavingKey(null);
    }
  };

  const getRecommendedPermission = (roleCode: string, featureCode: string) => {
    if (roleCode === "super_admin") return { allowed: true, scope: "all" as const };
    if (roleCode === "org_admin") {
      if (featureCode === "permissions.manage") return { allowed: false, scope: "none" as const };
      return { allowed: true, scope: "org" as const };
    }
    if (roleCode === "user") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "own" as const };
      return { allowed: false, scope: "none" as const };
    }
    if (roleCode === "qc") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "org" as const };
      return { allowed: false, scope: "none" as const };
    }
    if (roleCode === "maker") {
      if (featureCode === "activities.create") return { allowed: true, scope: "org" as const };
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "own" as const };
      return { allowed: false, scope: "none" as const };
    }
    if (roleCode === "checker") {
      if (featureCode === "activities.update_progress") return { allowed: true, scope: "org" as const };
      return { allowed: false, scope: "none" as const };
    }
    return { allowed: false, scope: "none" as const };
  };

  const applyRecommendedDefaults = async () => {
    if (permissionRoles.length === 0 || permissionFeatures.length === 0) return;
    setApplyingDefaults(true);
    setPermissionError(null);
    setPermissionStatus(null);
    try {
      const nextMatrix: Record<string, PermissionCell> = { ...permissionMatrix };

      for (const role of permissionRoles) {
        for (const feature of permissionFeatures) {
          const recommended = getRecommendedPermission(role.code, feature.code);
          await permissionsService.upsertRolePermission({
            role_id: role.id,
            feature_id: feature.id,
            allowed: recommended.allowed,
            scope: recommended.scope,
          });
          nextMatrix[`${role.id}:${feature.id}`] = {
            roleId: role.id,
            featureId: feature.id,
            allowed: recommended.allowed,
            scope: recommended.scope,
          };
        }
      }

      setPermissionMatrix(nextMatrix);
      setPermissionStatus("Recommended defaults applied successfully.");
    } catch (e: any) {
      setPermissionError(e?.message || "Failed to apply defaults.");
    } finally {
      setApplyingDefaults(false);
    }
  };

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
      localStorage.setItem(`dashboard_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(`dashboard_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return defaultValue;
    }
  }, []);

  // Set dynamic page title
  useEffect(() => {
    document.title = "Super Admin | RTP";
  }, [searchParams]);

  // Initialize state from URL params and localStorage
  useEffect(() => {
    // Restore tab from URL params first, then localStorage
    const tabFromURL = searchParams.get('tab');
    const tabFromStorage = loadFromLocalStorage('activeTab', 'dashboard');
    setActiveTab(tabFromURL || tabFromStorage);

    // Restore selected org
    const orgFromURL = searchParams.get('org');
    const orgFromStorage = loadFromLocalStorage('selectedOrgId', '');
    setSelectedOrgId(orgFromURL || orgFromStorage);

    // Restore sidebar state
    const sidebarOpen = loadFromLocalStorage('sidebarOpen', true);
    setSidebarOpen(sidebarOpen);

    // Restore sort and filter states
    setOrgSortField(loadFromLocalStorage('orgSortField', 'created_at'));
    setOrgSortOrder(loadFromLocalStorage('orgSortOrder', 'desc'));
    setProjectSortField(loadFromLocalStorage('projectSortField', 'created_at'));
    setProjectSortOrder(loadFromLocalStorage('projectSortOrder', 'desc'));
    setOrgFilter(loadFromLocalStorage('orgFilter', ''));
    setProjectFilter(loadFromLocalStorage('projectFilter', ''));

    // Restore dark mode
    const darkMode = loadFromLocalStorage('darkMode', false);
    setDark(darkMode);
  }, [searchParams]); // Run when searchParams change

  // Save state changes to URL params and localStorage
  useEffect(() => {
    updateURLParams({ tab: activeTab });
    saveToLocalStorage('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedOrgId) {
      updateURLParams({ org: selectedOrgId });
      saveToLocalStorage('selectedOrgId', selectedOrgId);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    saveToLocalStorage('sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    saveToLocalStorage('orgSortField', orgSortField);
    saveToLocalStorage('orgSortOrder', orgSortOrder);
    saveToLocalStorage('projectSortField', projectSortField);
    saveToLocalStorage('projectSortOrder', projectSortOrder);
  }, [orgSortField, orgSortOrder, projectSortField, projectSortOrder]);

  useEffect(() => {
    saveToLocalStorage('orgFilter', orgFilter);
    saveToLocalStorage('projectFilter', projectFilter);
  }, [orgFilter, projectFilter]);

  useEffect(() => {
    saveToLocalStorage('darkMode', dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  
  const toggleTheme = () => {
    const newTheme = !dark;
    setDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  // ✅ FETCH DATA
  const fetchOrganizations = async () => {
    console.log("🔍 DEBUG: Fetching organizations from Supabase...");
    
    // Check current user authentication
    const { data: { user } } = await supabase.auth.getUser();
    console.log("🔍 DEBUG: Current authenticated user:", user?.id, user?.email);
    
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("🔍 DEBUG: Error fetching organizations:", error);
      console.error("🔍 DEBUG: Error details:", error.message, error.code, error.hint);
    } else {
      console.log("🔍 DEBUG: Organizations fetched:", data?.length || 0, "organizations");
      console.log("🔍 DEBUG: Organization data:", data);
      setOrgs(data || []);
      
      // Also log organizations count separately for verification
      console.log("🔍 DEBUG: Organizations state set to:", data?.length || 0, "organizations");
      console.log("🔍 DEBUG: Organizations should display in Organizations tab");
    }
  };

  const fetchProjects = async (orgId: string) => {
    // Debug: Log organization_id
    console.log("🔍 DEBUG: Selected Org ID:", selectedOrgId);
    console.log("🔍 DEBUG: Fetching projects with orgId:", orgId);
    console.log("🔍 DEBUG: orgId type:", typeof orgId);
    console.log("🔍 DEBUG: orgId is UUID?", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId || ""));
    
    // If no organization selected, show all projects for superadmin
    // If organization selected, filter by that organization
    let query = supabase
      .from("projects")
      .select(`
        id,
        project_name,
        organization_id,
        status,
        location,
        start_date,
        end_date,
        created_at
      `);

    // Filter by organization if one is selected
    if (orgId && orgId !== "") {
      query = query.eq("organization_id", orgId);
      console.log("🔍 DEBUG: Filtering by organization_id:", orgId);
    } else {
      console.log("🔍 DEBUG: No organization filter - showing all projects");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (!error) {
      console.log("🔍 DEBUG: Super Admin - Projects data fetched:", data);
      console.log("🔍 DEBUG: Super Admin - First project structure:", data?.[0]);
      console.log("🔍 DEBUG: Super Admin - Organization data:", data?.[0]?.organizations);
      setProjects(data || []);
    } else {
      console.error("🔍 DEBUG: Super Admin - Error fetching projects:", error);
    }
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

  // Fetch issues
  const fetchIssues = async () => {
    try {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching issues:", error);
      } else {
        setIssues(data || []);
      }
    } catch (err) {
      console.error("Exception fetching issues:", err);
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchAdmins();
    fetchIssues();
  }, []);

  // PROTECT SUPER ADMIN PAGE (TEMPORARILY DISABLED)
  // useEffect(() => {
  //   const checkAccess = async () => {
  //     const { data: authData } = await supabase.auth.getUser();

  //     if (!authData.user) {
  //       window.location.href = "/";
  //       return;
  //     }

  //     const { data: userData } = await supabase
  //       .from("users")
  //       .select("role")
  //       .eq("id", authData.user.id)
  //       .single();

  //     if (userData?.role !== "super_admin") {
  //       alert("Unauthorized access");
  //       window.location.href = "/";
  //     }
  //   };

  //   checkAccess();
  // }, []);

  useEffect(() => {
    fetchProjects(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    if (activeTab === "organizations") {
      fetchAllProjects();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "admins") {
      fetchAdmins();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "permissions") {
      loadPermissions();
    }
  }, [activeTab, loadPermissions]);

  useEffect(() => {
    if (activeTab === "project-dashboard") {
      fetchAllProjects();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "project-dashboard" && pdSelectedProject) {
      const fetchPdActivities = async () => {
        setPdLoading(true);
        try {
          const { data, error } = await supabase
            .from("activities")
            .select("*, progress_updates(progress_percent, date)")
            .eq("project_id", pdSelectedProject)
            .order("created_at", { ascending: false });

          if (error) { console.error(error); return; }

          const activities = (data || []).map((a: any) => {
            const updates = a.progress_updates || [];
            const latest = updates.sort((x: any, y: any) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
            return { ...a, progress: latest?.progress_percent ?? 0 };
          });

          const today = new Date();
          const summary = activities.reduce((acc: any, a: any) => {
            acc.total++;
            if (a.progress === 100) acc.completed++;
            else if (a.progress > 0) acc.inProgress++;
            else acc.notStarted++;
            if (a.progress < 100 && a.planned_end && new Date(a.planned_end) < today) acc.delayed++;
            return acc;
          }, { total: 0, completed: 0, inProgress: 0, notStarted: 0, delayed: 0 });

          setPdActivities(activities);
          setPdSummary(summary);
        } finally {
          setPdLoading(false);
        }
      };
      fetchPdActivities();
    }
  }, [pdSelectedProject, activeTab]);

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
      window.location.href = "/super-admin";
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

  
  // CREATE ORG ADMIN
  const createOrgAdmin = async () => {
    try {
      // Debug: Show current user UUID
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        console.log("Current user UUID:", data.user.id);
      } else {
        console.log("No authenticated user found");
      }

      // 1. Create Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
      });

      if (authError) throw authError;

      // 2. Insert into users table
      if (!authData.user) throw new Error("Auth user not created");
      
      const { error: dbError } = await supabase.from("users").insert({
        id: authData.user.id, // VERY IMPORTANT
        email: adminEmail,
        role: "org_admin",
        organization_id: selectedOrgId, // UUID
      });

      if (dbError) throw dbError;

      alert("Org admin created");

      fetchAdmins(); // refresh list
      
      // clear fields
      setAdminEmail("");
      setAdminPassword("");
      setSelectedOrgId("");
    } catch (err) {
      console.error(err);
      alert("Error creating admin");
    }
  };

  // FETCH ADMINS
  const fetchAdmins = async () => {
    console.log("Fetching admins...");
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        email,
        role,
        created_at,
        organization_id
      `)
      .eq("role", "org_admin");

    if (error) {
      console.error("Error fetching admins:", error);
    } else {
      console.log("Fetched admins data:", data);
      console.log("Number of admins:", data?.length || 0);
      setAdmins(data);
    }
  };

  // CHECK USER ROLE
  const checkUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    return data?.role;
  };

  // EDIT ORG
  const startEditOrg = (org: any) => {
    setEditingOrg(org.id);
    setEditOrgName(org.organization_name);
  };

  const saveEditOrg = async () => {
    if (!editingOrg || !editOrgName) return;

    await supabase
      .from("organizations")
      .update({ organization_name: editOrgName })
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
    setEditProjectName(project.project_name);
    setEditProjectClient(project.organizations?.organization_name || "");
    setEditProjectLocation(project.location || "");
    setEditProjectStatus(project.status || "");
    setEditProjectStartDate(project.start_date || "");
    setEditProjectEndDate(project.end_date || "");
  };

  const saveEditProject = async () => {
    if (!editingProject || !editProjectName) return;

    await supabase
      .from("projects")
      .update({ 
        project_name: editProjectName,
        organization_name: editProjectClient,
        location: editProjectLocation,
        status: editProjectStatus,
        start_date: editProjectStartDate,
        end_date: editProjectEndDate
      })
      .eq("id", editingProject);

    setEditingProject(null);
    setEditProjectName("");
    setEditProjectClient("");
    setEditProjectLocation("");
    setEditProjectStatus("");
    setEditProjectStartDate("");
    setEditProjectEndDate("");
    await fetchProjects(selectedOrgId);
    await fetchAllProjects();
  };

  const cancelEditProject = () => {
    setEditingProject(null);
    setEditProjectName("");
    setEditProjectClient("");
    setEditProjectLocation("");
    setEditProjectStatus("");
    setEditProjectStartDate("");
    setEditProjectEndDate("");
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
    console.log("🔍 DEBUG: getFilteredAndSortedOrgs called");
    console.log("🔍 DEBUG: Total orgs:", orgs.length);
    console.log("🔍 DEBUG: orgFilter value:", orgFilter);
    console.log("🔍 DEBUG: All orgs:", orgs);
    
    let filtered = orgs.filter(org => 
      org.organization_name.toLowerCase().includes(orgFilter.toLowerCase())
    );

    console.log("🔍 DEBUG: Filtered orgs:", filtered.length);
    console.log("🔍 DEBUG: Filtered orgs data:", filtered);

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
    console.log("🔍 DEBUG: Projects array:", projects);
    console.log("🔍 DEBUG: Project filter value:", projectFilter);
    
    let filtered = projects.filter(project => {
      console.log("🔍 DEBUG: Project item:", project);
      console.log("🔍 DEBUG: Project name:", project.name);
      return project.project_name.toLowerCase().includes(projectFilter.toLowerCase());
    });

    console.log("🔍 DEBUG: Filtered projects:", filtered);

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

            {/* USER MANAGEMENT */}
            <div
              onClick={() => setActiveTab("user-management")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "user-management" ? "bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border-indigo-400/50 shadow-lg shadow-indigo-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "user-management" ? "text-indigo-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">User Management</span>}
            </div>

            
            {/* PROJECT DASHBOARD */}
            <div
              onClick={() => setActiveTab("project-dashboard")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "project-dashboard" ? "bg-gradient-to-r from-teal-500/20 to-green-500/20 border-teal-400/50 shadow-lg shadow-teal-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "project-dashboard" ? "text-teal-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Project Dashboard</span>}
            </div>

            {/* ISSUES */}
            <div
              onClick={() => setActiveTab("issues")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "issues" ? "bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/50 shadow-lg shadow-red-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "issues" ? "text-red-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Issues</span>}
            </div>

            {/* PERMISSIONS CONSOLE */}
            <div
              onClick={() => setActiveTab("permissions")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "permissions" ? "bg-gradient-to-r from-cyan-500/20 to-sky-500/20 border-cyan-400/50 shadow-lg shadow-cyan-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "permissions" ? "text-cyan-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3m6 0a3 3 0 11-6 0m9 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Permissions</span>}
            </div>

            {/* ORG ADMINS */}
            <div
              onClick={() => setActiveTab("admins")}
              className={`flex ${sidebarOpen ? 'items-center gap-3' : 'justify-center'} p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                activeTab === "admins" ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-400/50 shadow-lg shadow-yellow-500/20" : "border-transparent hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === "admins" ? "text-yellow-400" : "text-gray-400"}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              {sidebarOpen && <span className="font-semibold uppercase tracking-wide text-sm">Org Admins</span>}
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
                    suppressHydrationWarning
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
                    value={selectedOrgId}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log("🔍 DEBUG: Organization dropdown changed to:", newValue);
                      console.log("🔍 DEBUG: Selected org type:", typeof newValue);
                      console.log("🔍 DEBUG: Selected org is UUID?", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newValue || ""));
                      setSelectedOrgId(newValue);
                    }}
                    className="w-full px-4 py-2.5 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  >
                    <option value="">Select Organization</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.organization_name}
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
                  
                  <button
                    onClick={() => router.push('/create-project-super-admin')}
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
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{p.project_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "organizations" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col h-[600px]">
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-blue-500/20 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">ORGANIZATIONS ({orgs.length})</h2>
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
                        suppressHydrationWarning
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
                        suppressHydrationWarning
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
                    {false ? ( // Temporarily disable empty check to force display
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
                      orgs.map((org) => (
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
                                org.organization_name
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                            {formatDate(org.created_at)}
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
                                  onClick={() => setSelectedOrgId(org.id)}
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
                        suppressHydrationWarning
                        className="pl-10 pr-4 py-2.5 w-64 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      />
                      <svg className="absolute left-3 top-2.5 w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="px-4 py-2.5 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                      >
                        <option value="">Select Organization</option>
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.organization_name}
                          </option>
                        ))}
                      </select>
                                            <button
                        onClick={() => router.push('/create-project-super-admin')}
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
                        ORGANIZATION NAME
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        LOCATION
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        START DATE
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        END DATE
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
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
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
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{project.project_name}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingProject === project.id ? (
                              <input
                                type="text"
                                value={editProjectClient}
                                onChange={(e) => setEditProjectClient(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                placeholder="Organization name"
                              />
                            ) : (
                              <span className="text-sm text-gray-900 dark:text-white">
                                {orgs.find((o: any) => o.id === project.organization_id)?.organization_name || 'N/A'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingProject === project.id ? (
                              <input
                                type="text"
                                value={editProjectLocation}
                                onChange={(e) => setEditProjectLocation(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                placeholder="Location"
                              />
                            ) : (
                              <span className="text-sm text-gray-900 dark:text-white">
                                {project.location || 'N/A'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingProject === project.id ? (
                              <select
                                value={editProjectStatus}
                                onChange={(e) => setEditProjectStatus(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="Active">Active</option>
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Upcoming">Upcoming</option>
                              </select>
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                project.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                project.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                project.status === 'Completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                project.status === 'On Hold' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                project.status === 'Cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                project.status === 'Upcoming' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {project.status || 'Unknown'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {editingProject === project.id ? (
                              <input
                                type="date"
                                value={editProjectStartDate}
                                onChange={(e) => setEditProjectStartDate(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              <span>
                                {formatDate(project.start_date)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {editingProject === project.id ? (
                              <input
                                type="date"
                                value={editProjectEndDate}
                                onChange={(e) => setEditProjectEndDate(e.target.value)}
                                className="px-3 py-1 border border-indigo-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              <span>
                                {formatDate(project.end_date)}
                              </span>
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
                                {project.organizations?.name || 'Unknown'}
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
                                <button 
                                  onClick={() => router.push(`/project-details?project_id=${project.id}`)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700 rounded transition-colors"
                                >
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

          {activeTab === "issues" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col max-h-[600px]">
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-red-500/10 via-pink-500/10 to-rose-500/10 dark:from-red-500/20 dark:via-pink-500/20 dark:to-rose-500/20 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-red-400 via-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 dark:from-red-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">ISSUES</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Debug & Track Application Issues</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = "/issues"}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transform hover:scale-105"
                  >
                    Manage Issues
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Issues Management</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Click "Manage Issues" to view and manage all application issues</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                      <div className="text-red-600 dark:text-red-400 font-semibold">Open Issues</div>
                      <div className="text-2xl font-bold text-red-700 dark:text-red-300">{issues.filter(i => i.status === 'open').length}</div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                      <div className="text-yellow-600 dark:text-yellow-400 font-semibold">In Progress</div>
                      <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{issues.filter(i => i.status === 'in_progress').length}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <div className="text-green-600 dark:text-green-400 font-semibold">Resolved</div>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">{issues.filter(i => i.status === 'resolved').length}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-3">
                      <div className="text-gray-600 dark:text-gray-400 font-semibold">Total</div>
                      <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{issues.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "permissions" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col">
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:via-sky-500/20 dark:to-blue-500/20">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 dark:from-cyan-400 dark:via-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
                      PERMISSIONS
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Control role access from this same screen
                    </p>
                  </div>
                  <button
                    onClick={applyRecommendedDefaults}
                    disabled={applyingDefaults || loadingPermissions}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {applyingDefaults ? "Applying..." : "Apply Recommended Defaults"}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {permissionError && (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300">
                    {permissionError}
                  </div>
                )}

                {permissionStatus && (
                  <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/40 dark:bg-green-950/30 dark:text-green-300">
                    {permissionStatus}
                  </div>
                )}

                {loadingPermissions ? (
                  <p className="text-gray-700 dark:text-gray-300">Loading permissions...</p>
                ) : (
                  <PermissionsConsole
                    roles={permissionRoles}
                    features={permissionFeatures}
                    matrix={permissionMatrix}
                    savingKey={permissionSavingKey}
                    onToggle={(roleId, featureId, nextAllowed) =>
                      upsertPermissionCell(roleId, featureId, { allowed: nextAllowed })
                    }
                    onScopeChange={(roleId, featureId, nextScope) =>
                      upsertPermissionCell(roleId, featureId, { scope: nextScope })
                    }
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "user-management" && (
            <SuperAdminUserManagementTab />
          )}

          {activeTab === "admins" && (
              <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20 flex flex-col max-h-[600px]">
                <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-amber-500/10 dark:from-yellow-500/20 dark:via-orange-500/20 dark:to-amber-500/20 flex-shrink-0">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 via-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/25">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-orange-600 to-amber-600 dark:from-yellow-400 dark:via-orange-400 dark:to-amber-400 bg-clip-text text-transparent">ORG ADMINS</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Manage Your Organization Administrators</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <input
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="Admin Email"
                      autoComplete="off"
                      suppressHydrationWarning
                      className="px-4 py-2.5 border border-yellow-200 dark:border-yellow-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                    />
                    <div className="relative">
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Admin Password"
                        autoComplete="off"
                        suppressHydrationWarning
                        className="w-full px-4 py-2.5 border border-yellow-200 dark:border-yellow-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-500 hover:text-yellow-600 transition-colors"
                      >
                        {showAdminPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.901a3 3 0 114.243 2.976 3.006 3.006 0 014.242-2.976m-4.243 2.976a3 3 0 00-4.242 2.976" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="px-4 py-2.5 border border-yellow-200 dark:border-yellow-800 rounded-xl bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                    >
                      <option value="">Select Organization</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.organization_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={createOrgAdmin}
                    className="w-full group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl hover:from-yellow-600 hover:to-orange-700 transition-all duration-300 shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transform hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Org Admin
                  </button>
                </div>
                <div className="mt-6 overflow-auto flex-1">
                  <table className="w-full">
                    <thead className="sticky top-0 z-30 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-b border-yellow-200 dark:border-yellow-800 backdrop-blur-sm shadow-md">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider">
                          EMAIL
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider">
                          ORGANIZATION
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider">
                          ROLE
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider">
                          CREATED DATE
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {admins.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center gap-3">
                              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              <p className="text-lg font-medium">No admins found</p>
                              <p className="text-sm">Create your first organization admin to get started</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        admins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {admin.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {orgs.find((o) => o.id === admin.organization_id)?.organization_name || "Organization " + admin.organization_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {admin.role}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(admin.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {activeTab === "project-dashboard" && (
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 dark:border-black/20">
              {/* Header */}
              <div className="p-6 border-b border-white/20 dark:border-black/20 bg-gradient-to-r from-teal-500/10 via-green-500/10 to-emerald-500/10 dark:from-teal-500/20 dark:via-green-500/20 dark:to-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-tr from-teal-400 via-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-green-600 to-emerald-600 dark:from-teal-400 dark:via-green-400 dark:to-emerald-400 bg-clip-text text-transparent">PROJECT DASHBOARD</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Monitor project progress and activity statistics</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Project selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Project</label>
                  <select
                    value={pdSelectedProject}
                    onChange={(e) => setPdSelectedProject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-black/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select a project...</option>
                    {allProjects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                  </select>
                </div>

                {pdSelectedProject && (
                  <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700">
                    <svg className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <div>
                      <p className="text-xs text-teal-600 dark:text-teal-400 font-medium uppercase tracking-wide">Organization</p>
                      <p className="text-base font-bold text-teal-800 dark:text-teal-200">
                        {(() => {
                          const proj = allProjects.find((p: any) => p.id === pdSelectedProject);
                          return orgs.find((o: any) => o.id === proj?.organization_id)?.organization_name || "N/A";
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {pdLoading && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
                )}

                {!pdLoading && pdSelectedProject && (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                      {[
                        { label: "Total", value: pdSummary.total, color: "blue" },
                        { label: "Completed", value: pdSummary.completed, color: "green" },
                        { label: "In Progress", value: pdSummary.inProgress, color: "orange" },
                        { label: "Not Started", value: pdSummary.notStarted, color: "gray" },
                        { label: "Delayed", value: pdSummary.delayed, color: "red" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center border border-gray-100 dark:border-gray-700">
                          <p className={`text-3xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-6 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Overall Completion</span>
                        <span>{pdSummary.total > 0 ? Math.round((pdSummary.completed / pdSummary.total) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-green-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${pdSummary.total > 0 ? Math.round((pdSummary.completed / pdSummary.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Activities list */}
                    {pdActivities.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                          <h3 className="font-semibold text-gray-900 dark:text-white">Activities</h3>
                        </div>
                        <div className="overflow-y-auto max-h-72">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Activity</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Planned End</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {pdActivities.map((a: any) => {
                                const isDelayed = a.progress < 100 && a.planned_end && new Date(a.planned_end) < new Date();
                                return (
                                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{a.activity_name || a.name}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                          <div
                                            className={`h-2 rounded-full ${a.progress === 100 ? "bg-green-500" : isDelayed ? "bg-red-500" : "bg-blue-500"}`}
                                            style={{ width: `${a.progress}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-gray-500 w-8">{a.progress}%</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                      {a.planned_end ? new Date(a.planned_end).toLocaleDateString() : "—"}
                                      {isDelayed && <span className="ml-1 text-red-500 font-semibold">Delayed</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!pdLoading && !pdSelectedProject && (
                  <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-lg font-medium">Select a project to view its dashboard</p>
                  </div>
                )}
              </div>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
