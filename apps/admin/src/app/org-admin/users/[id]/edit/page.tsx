'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';

interface User {
  id: string;
  email: string;
  role: string;
  organization_id?: string;
  created_at: string;
  user_name: string;
}

export default function EditUserPage() {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>('');
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    role: 'user',
    organization_id: '',
    password: ''
  });

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, role, organization_id, user_name, email, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        setError('User not found');
      } else {
        setUserData(data);
        setFormData({
          user_name: data.user_name,
          email: data.email,
          role: data.role,
          organization_id: data.organization_id || '',
          password: ''
        });

        // Fetch organization name if organization_id exists
        if (data.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('organization_name')
            .eq('id', data.organization_id)
            .single();
          
          if (orgData) {
            setOrganizationName(orgData.organization_name);
          }
        }
      }
    } catch (err) {
      console.error('Exception fetching user:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_name || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
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

      // Update user in public.users table - org admin can change user and org_admin roles only
      const { data: user, error: userError } = await supabase
        .from('users')
        .update({
          user_name: formData.user_name,
          email: formData.email,
          role: formData.role,
          organization_id: formData.organization_id || null
        })
        .eq('id', userId)
        .select()
        .single();

      if (userError) {
        console.error('Error updating user:', userError);
        setError('Failed to update user: ' + userError.message);
      } else {
        alert('User updated successfully!');
        router.push('/org-admin/users');
      }
    } catch (err) {
      console.error('Exception updating user:', err);
      setError('An unexpected error occurred while updating the user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete user "${userData?.user_name}"? This action cannot be undone.`)) {
      try {
        // Delete from public.users table
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) {
          console.error('Error deleting user:', error);
          setError('Failed to delete user: ' + error.message);
        } else {
          alert('User deleted successfully!');
          router.push('/org-admin/users');
        }
      } catch (err) {
        console.error('Exception deleting user:', err);
        setError('An unexpected error occurred while deleting the user.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-medium mb-4">
            {error}
          </div>
          <button
            onClick={() => router.push('/org-admin/users')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit User
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Update user information
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="user_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="user_name"
                name="user_name"
                value={formData.user_name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role *
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="user">User</option>
                <option value="org_admin">Org Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Leave empty to keep current password"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to keep current password</p>
            </div>

            <div>
              <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization
              </label>
              <input
                type="text"
                id="organization_id"
                name="organization_id"
                value={organizationName || formData.organization_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Organization"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating...' : 'Update User'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/org-admin/users')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete User
              </button>
            </div>
          </form>

          {userData && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">User Name</p>
                  <p className="text-gray-900 dark:text-white">{userData.user_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
