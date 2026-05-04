'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

interface Activity {
  id: string;
  activity_name: string;
  project_id: string;
  zone_id: string;
  task_id?: string | null;
  quantity?: number;
  unit?: string;
  boq_rate?: number;
  planned_start: string;
  planned_end: string;
  task?: {
    wbs_code: string;
    task_name: string;
  };
  zone?: {
    zone_name: string;
  };
}

interface QSFormData {
  quantity: string;
  unit: string;
  boq_rate: string;
}

export default function QSPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<QSFormData>({
    quantity: '',
    unit: '',
    boq_rate: ''
  });
  const router = useRouter();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          task:tasks(wbs_code, task_name),
          zone:zones(zone_name)
        `)
        .order('activity_name');

      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };

  const handleActivitySelect = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      setSelectedActivity(activityId);
      setFormData({
        quantity: activity.quantity?.toString() || '',
        unit: activity.unit || '',
        boq_rate: activity.boq_rate?.toString() || ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedActivity) {
      setError('Please select an activity');
      return;
    }

    if (!formData.quantity || !formData.unit || !formData.boq_rate) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('activities')
        .update({
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          boq_rate: parseFloat(formData.boq_rate)
        })
        .eq('id', selectedActivity);

      if (error) throw error;

      setSuccess('Quantity survey data updated successfully!');
      await fetchActivities();
      
      // Reset form
      setFormData({ quantity: '', unit: '', boq_rate: '' });
      setSelectedActivity('');
    } catch (err) {
      console.error('Error updating QS data:', err);
      setError('Failed to update quantity survey data');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalValue = (activity: Activity) => {
    if (activity.quantity && activity.boq_rate) {
      return activity.quantity * activity.boq_rate;
    }
    return 0;
  };

  const getTotalProjectValue = () => {
    return activities.reduce((total, activity) => total + calculateTotalValue(activity), 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Quantity Surveying
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage activity quantities and BOQ rates
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/planning')}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Planning
              </button>
              <button
                onClick={() => router.push('/activities')}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Activities
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                Total Activities
              </h3>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {activities.length}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                Activities with QS Data
              </h3>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {activities.filter(a => a.quantity && a.unit && a.boq_rate).length}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
                Total Project Value
              </h3>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${getTotalProjectValue().toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* QS Form - Modal-Inline Form Pattern */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Update Quantity Survey Data
                </h2>
                {selectedActivity && (
                  <button
                    onClick={() => {
                      setSelectedActivity('');
                      setFormData({ quantity: '', unit: '', boq_rate: '' });
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {selectedActivity && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Editing: {activities.find(a => a.id === selectedActivity)?.activity_name}
                  </p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Activity Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Activity *
                  </label>
                  <select
                    value={selectedActivity}
                    onChange={(e) => handleActivitySelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select an activity...</option>
                    {activities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.activity_name} 
                        {activity.task && ` (${'  '.repeat(activity.task.level || 0)}${activity.task.wbs_code} - ${activity.task.task_name})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter quantity"
                    required
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unit *
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., m, m2, m3, kg, pcs"
                    required
                  />
                </div>

                {/* BOQ Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    BOQ Rate ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.boq_rate}
                    onChange={(e) => setFormData({ ...formData, boq_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter BOQ rate"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {submitting ? 'Updating...' : 'Update QS Data'}
                </button>
              </form>

              {/* Messages */}
              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
                  {success}
                </div>
              )}
            </div>

            {/* Activities List */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Activities QS Status
              </h2>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No activities found
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`p-4 rounded-lg border ${
                        selectedActivity === activity.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {activity.activity_name}
                          </h3>
                          {activity.task && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              WBS: {activity.task.wbs_code} - {activity.task.task_name}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Zone: {activity.zone?.zone_name || 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleActivitySelect(activity.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                      
                      {activity.quantity && activity.unit && activity.boq_rate ? (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {activity.quantity} {activity.unit}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Rate:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              ${activity.boq_rate}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Total:</span>
                            <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                              ${calculateTotalValue(activity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          QS data not set
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
