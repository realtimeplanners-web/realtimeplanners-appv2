'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

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

export default function OrgAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

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

  // Handle create user
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users first
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, role, organization_id, user_name, email, created_at')
        .eq('role', 'user')
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Org Users Management
              </h1>
              {userData && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Org Admin : {userData.email}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/org-admin')}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 dark:text-red-400 text-lg font-medium mb-4">
                {error}
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-4">
                No users found
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Add User Button */}
              <div className="mb-6">
                <button
                  onClick={() => router.push('/org-admin/users/create')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add User
                </button>
              </div>

              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'org_admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/org-admin/users/${user.id}/edit`)}
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
    </div>
  );

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
}
