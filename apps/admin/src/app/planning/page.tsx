'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  level: number;
  wbs_code: string;
  task_name: string;
  created_at: string;
  updated_at: string;
  sort_order?: number;
  parent_missing?: boolean;
  children?: Task[];
  project?: {
    project_name: string;
  };
}

interface Project {
  id: string;
  project_name: string;
  organization_id?: string;
}

interface Zone {
  id: string;
  project_id: string;
  name: string;
  zone_name?: string;
  created_at?: string;
}

export default function PlanningPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    task_name: '',
    parent_id: '' as string | null
  });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const router = useRouter();

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showCreateForm) return;

      if (event.key === 'Escape') {
        // Escape key - close form
        setShowCreateForm(false);
        setEditingTask(null);
        setNewTask({ task_name: '', parent_id: '' });
        setError(null);
      } else if (event.key === 'Enter' && !event.shiftKey) {
        // Enter key - save task (prevent default to avoid form submission)
        event.preventDefault();
        if (editingTask) {
          updateTask();
        } else {
          createTask();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateForm, editingTask, newTask, selectedProject]);

  useEffect(() => {
    // Fetch user and organization data first
    const fetchUserAndOrg = async () => {
      try {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to access planning');
          setLoading(false);
          return;
        }

        setUser(user);

        // Fetch user data including role and organization (same as activities page)
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, role, organization_id, user_name")
          .eq("id", user.id)
          .single();

        if (userError || !userData) {
          console.error('Error fetching user data:', userError);
          setError('Failed to fetch user data');
          setLoading(false);
          return;
        }

        const userName = userData.user_name || user.email || 'Unknown User';
        const orgId = userData.organization_id || '';
        
        console.log('User data:', { userName, orgId, userData });
        
        setUserName(userName);
        setOrganizationId(orgId);
        
        // Fetch organization name separately
        if (orgId) {
          try {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('organization_name')
              .eq('id', orgId)
              .single();
            
            if (orgError) {
              console.error('Error fetching organization name:', orgError);
              setOrganizationName('Unknown Organization');
            } else {
              setOrganizationName(orgData?.organization_name || 'Unknown Organization');
            }
          } catch (err) {
            console.error('Exception fetching organization name:', err);
            setOrganizationName('Unknown Organization');
          }
        }
        
        // Test query to check projects table structure
        try {
          const { data: testProjects, error: testError } = await supabase
            .from('projects')
            .select('*')
            .limit(5);
          
          console.log('Test projects query result:', { testProjects, testError });
          if (testProjects && testProjects.length > 0) {
            console.log('Sample project structure:', Object.keys(testProjects[0]));
          }
        } catch (testErr) {
          console.error('Test projects query failed:', testErr);
        }
        
        await fetchProjects(orgId);
        setLoading(false);
      } catch (err) {
        console.error('Error in authentication:', err);
        setError('Authentication failed');
        setLoading(false);
      }
    };

    fetchUserAndOrg();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchZones();
      setSelectedZone(''); // Reset zone when project changes
    } else {
      setZones([]);
      setSelectedZone('');
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && selectedZone) {
      fetchTasks();
    } else {
      setTasks([]); // Clear tasks when zone is not selected
    }
  }, [selectedProject, selectedZone]);

  const fetchProjects = async (orgId?: string) => {
    try {
      console.log('Fetching projects for organization:', orgId);
      
      // First try with the correct column names
      let query = supabase
        .from('projects')
        .select('id, project_name, organization_id')
        .order('project_name');

      // Filter by organization_id if provided
      if (orgId) {
        query = query.eq('organization_id', orgId);
        console.log('Applied organization filter:', orgId);
      } else {
        console.log('No organization filter applied');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error fetching projects:', error);
        throw error;
      }
      
      console.log('Projects fetched successfully:', data);
      
      // Transform data to match expected format
      const transformedData = data?.map(project => ({
        id: project.id,
        project_name: project.project_name
      })) || [];
      
      setProjects(transformedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects');
    }
  };

  const fetchZones = async () => {
    if (!selectedProject) return;

    try {
      const { data, error } = await supabase
        .from('zones')
        .select('id, project_id, zone_name, created_at')
        .eq('project_id', selectedProject)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match expected format
      const transformedData = data?.map(zone => ({
        id: zone.id,
        project_id: zone.project_id,
        name: zone.zone_name
      })) || [];
      
      setZones(transformedData);
    } catch (err) {
      console.error('Error fetching zones:', err);
      setError('Failed to fetch zones');
    }
  };

  const createZone = async (zoneName: string) => {
    if (!selectedProject || !zoneName) return;

    try {
      const { data, error } = await supabase
        .from('zones')
        .insert({
          project_id: selectedProject,
          zone_name: zoneName
        })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh zones list
      await fetchZones();
      
      // Auto-select the newly created zone
      if (data) {
        setSelectedZone(data.id);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error creating zone:', err);
      setError('Failed to create zone');
    }
  };

  // Fix existing "temp" WBS values
  const fixExistingWbsCodes = async () => {
    if (!selectedProject) return;

    try {
      console.log('Fixing existing WBS codes...');
      
      // Get all tasks for the project
      const { data: allTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      if (!allTasks || allTasks.length === 0) {
        console.log('No tasks found to fix');
        return;
      }

      // Separate root tasks and child tasks
      const rootTasks = allTasks.filter(task => !task.parent_id);
      const childTasks = allTasks.filter(task => task.parent_id);

      // Fix root tasks first
      let rootCounter = 1;
      for (const rootTask of rootTasks) {
        const newWbsCode = rootCounter.toString();
        await supabase
          .from('tasks')
          .update({ wbs_code: newWbsCode })
          .eq('id', rootTask.id);
        rootTask.wbs_code = newWbsCode;
        rootCounter++;
      }

      // Fix child tasks based on parent
      for (const childTask of childTasks) {
        const parent = allTasks.find(t => t.id === childTask.parent_id);
        if (parent) {
          // Count siblings
          const siblings = childTasks.filter(t => t.parent_id === childTask.parent_id);
          const siblingIndex = siblings.findIndex(t => t.id === childTask.id);
          const newWbsCode = `${parent.wbs_code}.${siblingIndex + 1}`;
          
          await supabase
            .from('tasks')
            .update({ wbs_code: newWbsCode })
            .eq('id', childTask.id);
          
          childTask.wbs_code = newWbsCode;
        }
      }

      console.log('Fixed WBS codes for', allTasks.length, 'tasks');
      
      // Refresh tasks display
      await fetchTasks();
      
    } catch (err) {
      console.error('Error fixing WBS codes:', err);
      setError('Failed to fix WBS codes');
    }
  };

  const fetchTasks = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      
      // Test query to check actual table structure
      try {
        const { data: testTasks, error: testError } = await supabase
          .from('tasks')
          .select('*')
          .limit(1);
        
        if (testError) {
          console.error('Tasks table structure error:', testError);
          setError('Tasks table not accessible: ' + testError.message);
          setTasks([]);
          return;
        }
        
        if (testTasks && testTasks.length > 0) {
          console.log('Actual tasks table columns:', Object.keys(testTasks[0]));
        }
      } catch (testErr) {
        console.error('Test query failed:', testErr);
        setError('Failed to access tasks table');
        setTasks([]);
        return;
      }
      
      // Filter tasks by zone: get all tasks that belong to this zone
      // Get all tasks for the project first, then filter by zone hierarchy
      const { data: allProjectTasks, error: allError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        .order('sort_order', { ascending: true });

      if (allError) {
        console.error('All tasks fetch error:', allError);
        setError('Failed to fetch tasks');
        setTasks([]);
        return;
      }

      // Filter tasks that belong to this zone (either direct children or descendants)
      const zoneTasks = allProjectTasks?.filter(task => {
        // If task is directly under this zone
        if (task.parent_id === selectedZone) {
          return true;
        }
        
        // If task is a descendant of a zone task
        // We need to check if any ancestor is this zone
        let currentParent = task.parent_id;
        while (currentParent) {
          const parentTask = allProjectTasks?.find(t => t.id === currentParent);
          if (parentTask) {
            if (parentTask.parent_id === selectedZone) {
              return true;
            }
            currentParent = parentTask.parent_id;
          } else {
            break;
          }
        }
        
        return false;
      }) || [];

      console.log('Filtered zone tasks:', zoneTasks.length, 'out of', allProjectTasks?.length || 0);

      // Use the filtered zone tasks data
      setTasks(zoneTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const buildTaskTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    const rootTasks: Task[] = [];

    // Create map of all tasks
    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    // Build tree structure
    tasks.forEach(task => {
      const taskNode = taskMap.get(task.id)!;
      if (task.parent_id && taskMap.has(task.parent_id)) {
        const parent = taskMap.get(task.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(taskNode);
      } else {
        rootTasks.push(taskNode);
      }
    });

    return rootTasks;
  };

  const generateWbsCode = async (parentId: string | null): Promise<{ level: number; wbsCode: string }> => {
    if (!parentId) {
      // Root task - find next number
      try {
        const { data: rootTasks, error } = await supabase
          .from('tasks')
          .select('wbs_code')
          .eq('project_id', selectedProject)
          .is('parent_id', null)
          .order('wbs_code', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching root tasks:', error);
          throw error;
        }

        const lastCode = rootTasks?.[0]?.wbs_code || '0';
        const nextNumber = parseInt(lastCode) + 1;
        return { level: 1, wbsCode: nextNumber.toString() };
      } catch (err) {
        console.error('Root task query failed:', err);
        // Fallback: return sequential number
        return { level: 1, wbsCode: Date.now().toString().slice(-4) };
      }
    }

    // Child task - get parent info
    try {
      // Check if parent is a zone (zones are in separate table)
      let parentTask = null;
      let level = 1;
      
      if (parentId === selectedZone) {
        // Parent is a zone - set level 2 and use numerical base
        level = 2;
        parentTask = {
          id: selectedZone,
          level: 1,
          wbs_code: '' // Start with empty string for zone-based numbering
        } as any;
      } else {
        // Regular task parent - fetch from tasks table
        const { data: taskData, error } = await supabase
          .from('tasks')
          .select('level, wbs_code')
          .eq('id', parentId)
          .single();

        if (error || !taskData) {
          console.error('Parent task not found:', error);
          throw new Error('Parent task not found');
        }
        
        parentTask = taskData;
        level = taskData.level + 1;
      }

      // Find siblings to get next number
      let nextNumber = 1;
      
      if (parentId === selectedZone) {
        // For zone parent, count existing children of this zone
        const { data: zoneChildren, error: zoneError } = await supabase
          .from('tasks')
          .select('wbs_code')
          .eq('project_id', selectedProject)
          .eq('parent_id', parentId)
          .order('wbs_code', { ascending: false });
        
        if (zoneError) {
          console.error('Error fetching zone children:', zoneError);
        } else {
          // Extract number from existing zone children (e.g., "1", "2", etc.)
          const lastZoneChild = zoneChildren?.[0];
          const lastCode = lastZoneChild?.wbs_code || '0';
          const lastNumber = parseInt(lastCode) || 0;
          nextNumber = lastNumber + 1;
        }
      } else {
        // For regular task parent, use existing logic
        const { data: siblings, error: siblingError } = await supabase
          .from('tasks')
          .select('wbs_code')
          .eq('project_id', selectedProject)
                  .eq('parent_id', parentId)
          .order('wbs_code', { ascending: false })
          .limit(1);

        const lastCode = siblings?.[0]?.wbs_code || '0';
        const lastNumber = parseInt(lastCode) + 1;
        nextNumber = lastNumber;
      }
      
      // Generate WBS code based on parent type
      let wbsCode: string;
      
      if (parentId === selectedZone) {
        // Zone parent: use simple numbering (1, 2, 3, etc.)
        wbsCode = nextNumber.toString();
      } else {
        // Regular task parent: use hierarchical numbering (parent.wbs_code + '.' + number)
        wbsCode = parentTask.wbs_code + '.' + nextNumber.toString();
      }
      
      return {
        level: parentTask.level + 1,
        wbsCode: wbsCode
      };
    } catch (err) {
      console.error('Child task generation failed:', err);
      throw err;
    }
  };

  const createTask = async () => {
    if (!selectedProject || !selectedZone || !newTask.task_name.trim()) {
      setError('Please select a project, zone, and enter task name');
      return;
    }

    try {
      // For zone-based WBS: if no parent_id specified, use zone as parent
      let parentId = newTask.parent_id;
      if (!parentId && selectedZone) {
        // First task under zone should have zone as parent
        parentId = selectedZone;
      }

      // Generate level and wbs_code
      const { level, wbsCode } = await generateWbsCode(parentId || null);

      // Get next sort_order
      let sortQuery = supabase
        .from('tasks')
        .select('sort_order')
        .eq('project_id', selectedProject)
        ;

      // Handle null parent_id properly
      if (newTask.parent_id === null || newTask.parent_id === '') {
        sortQuery = sortQuery.is('parent_id', null);
      } else {
        sortQuery = sortQuery.eq('parent_id', newTask.parent_id);
      }

      const { data: lastTask } = await sortQuery
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (lastTask?.[0]?.sort_order || 0) + 1;

      // Try to insert task
      const now = new Date().toISOString();
      
      console.log('Creating task with:', {
        project_id: selectedProject,
        parent_id: parentId,
        level,
        wbs_code: wbsCode,
        sort_order: nextSortOrder,
        task_name: newTask.task_name.trim(),
        created_at: now,
        updated_at: now
      });
      
      const { data, error } = await supabase
            .from('tasks')
            .insert({
              project_id: selectedProject,
              parent_id: parentId,
              level: level,
              wbs_code: wbsCode,
              sort_order: nextSortOrder,
              task_name: newTask.task_name.trim(),
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

      if (error) {
        console.error('Database insert error:', error);
        setError(`Failed to create task: ${error.message || 'Unknown error'}`);
        return;
      }

      // Get all tasks for WBS recalculation
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject);

      if (allTasks) {
        // Recalculate all WBS codes after creation
        await recalculateWbsCodes(allTasks);
      }

      // Reset form
      setNewTask({ task_name: '', parent_id: '' });
      setShowCreateForm(false);
      
      // Refresh tasks
      await fetchTasks();
      
      // Expand parent if it exists
      if (data?.parent_id) {
        setExpandedNodes(prev => new Set(prev).add(data.parent_id));
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setError(`Failed to create task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      task_name: task.task_name,
      parent_id: task.parent_id || ''
    });
    setShowCreateForm(true);
  };

  const updateTask = async () => {
    if (!editingTask || !newTask.task_name.trim()) {
      setError('Please enter task name');
      return;
    }

    // Validate zone_id - tasks cannot change zones
    if (!selectedZone) {
      setError('Zone must be selected to update tasks');
      return;
    }

    try {
      // Check if WBS code has changed
      const originalTask = tasks.find(t => t.id === editingTask.id);
      const wbsCodeChanged = originalTask && originalTask.wbs_code !== editingTask.wbs_code;
      
      if (wbsCodeChanged) {
        // Restructure WBS tree if code changed
        await restructureWbsTree(editingTask.id, editingTask.wbs_code);
        
        // Update task name separately if needed
        if (editingTask.task_name !== newTask.task_name.trim()) {
          await supabase
            .from('tasks')
            .update({
              task_name: newTask.task_name.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', editingTask.id);
        }
      } else {
        // Simple update for task name and parent only
        const { error } = await supabase
          .from('tasks')
          .update({
            task_name: newTask.task_name.trim(),
            parent_id: newTask.parent_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTask.id);

        if (error) {
          console.error('Database update error:', error);
          setError(`Failed to update task: ${error.message || 'Unknown error'}`);
          return;
        }
        
        // Refresh tasks
        await fetchTasks();
      }

      // Reset form
      setNewTask({ task_name: '', parent_id: '' });
      setEditingTask(null);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Error updating task:', err);
      setError(`Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task and all its subtasks?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Database delete error:', error);
        setError(`Failed to delete task: ${error.message || 'Unknown error'}`);
        return;
      }
      
      // Get all tasks for WBS recalculation
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      if (allTasks) {
        // Recalculate all WBS codes after deletion
        await recalculateWbsCodes(allTasks);
      }
      
      // Refresh tasks
      await fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedNodes((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allTaskIds = tasks.map(task => task.id);
    setExpandedNodes(new Set(allTaskIds));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const recalculateWbsCodes = async (allTasks: Task[]) => {
    // Sort tasks by WBS code to maintain hierarchy (handle null values)
    const sortedTasks = allTasks.sort((a, b) => {
      const aCode = a.wbs_code || '';
      const bCode = b.wbs_code || '';
      return aCode.localeCompare(bCode);
    });

    // Group tasks by parent
    const tasksByParent = new Map<string | null, Task[]>();
    sortedTasks.forEach(task => {
      const parentId = task.parent_id;
      if (!tasksByParent.has(parentId)) {
        tasksByParent.set(parentId, []);
      }
      tasksByParent.get(parentId)!.push(task);
    });

    // Recalculate WBS codes
    const recalculateLevel = async (parentId: string | null, parentCode: string = '', level: number = 1) => {
      const children = tasksByParent.get(parentId) || [];
      children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        let newWbsCode: string;
        
        if (level === 1) {
          newWbsCode = (i + 1).toString();
        } else {
          newWbsCode = `${parentCode}.${i + 1}`;
        }
        
        // Update task in database
        console.log(`Updating task ${child.id}: ${child.wbs_code} -> ${newWbsCode} (level: ${level})`);
        await supabase
          .from('tasks')
          .update({
            wbs_code: newWbsCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', child.id);
        
        // Recursively update children
        await recalculateLevel(child.id, newWbsCode, level + 1);
      }
    };

    // Start recalculation from root
    await recalculateLevel(null);
  };

  const handleIndent = async (taskId: string) => {
    try {
      // Get current task and all tasks for finding previous sibling
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      // Prevent indenting level 1 tasks
      if (currentTask.level <= 1) {
        setError('Cannot indent root level tasks');
        return;
      }

      // Get all tasks sorted by level and wbs_code
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
                .order('level, wbs_code');

      if (!allTasks) return;

      // Find previous sibling (same level, above current task)
      const siblings = allTasks.filter(t => 
        t.level === currentTask.level && 
        t.parent_id === currentTask.parent_id
      );
      const currentIndex = siblings.findIndex(t => t.id === taskId);
      
      if (currentIndex > 0) {
        const previousSibling = siblings[currentIndex - 1];
        
        // Update current task to be child of previous sibling
        const { error } = await supabase
          .from('tasks')
          .update({
            parent_id: previousSibling.id,
            level: previousSibling.level + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (error) {
          setError(`Failed to indent task: ${error.message}`);
          return;
        }

        // Recalculate all WBS codes
        await recalculateWbsCodes(allTasks);
        
        // Refresh tasks
        await fetchTasks();
      } else {
        setError('No previous sibling found to indent under');
      }
    } catch (err) {
      console.error('Error indenting task:', err);
      setError('Failed to indent task');
    }
  };

  const handleOutdent = async (taskId: string) => {
    try {
      // Get current task
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      // Prevent outdenting level 1 tasks
      if (currentTask.level <= 1) {
        setError('Cannot outdent root level tasks');
        return;
      }

      // Get current parent
      const { data: parentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', currentTask.parent_id)
        .single();

      if (!parentTask) {
        setError('Parent task not found');
        return;
      }

      // Update current task to be sibling of its parent
      const { error } = await supabase
        .from('tasks')
        .update({
          parent_id: parentTask.parent_id,
          level: currentTask.level - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) {
        setError(`Failed to outdent task: ${error.message}`);
        return;
      }

      // Get all tasks for WBS recalculation
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      if (allTasks) {
        // Recalculate all WBS codes
        await recalculateWbsCodes(allTasks);
        
        // Refresh tasks
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error outdenting task:', err);
      setError('Failed to outdent task');
    }
  };

  const handleAddParent = async (taskId: string) => {
    try {
      // Get current task
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      const now = new Date().toISOString();

      // Generate proper WBS code for the new parent
      const { wbsCode: newParentWbsCode } = await generateWbsCode(currentTask.parent_id);
      
      // Create new parent task
      const { data: newParent, error: parentError } = await supabase
        .from('tasks')
        .insert({
          project_id: selectedProject,
          parent_id: currentTask.parent_id,
          level: currentTask.level,
          task_name: 'New Parent',
          wbs_code: newParentWbsCode,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (parentError || !newParent) {
        setError(`Failed to create parent: ${parentError?.message || 'Unknown error'}`);
        return;
      }

      // Update current task to be child of new parent
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          parent_id: newParent.id,
          level: currentTask.level + 1,
          updated_at: now
        })
        .eq('id', taskId);

      if (updateError) {
        setError(`Failed to update current task: ${updateError.message}`);
        return;
      }

      // Get all tasks for WBS recalculation
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      if (allTasks) {
        // Recalculate all WBS codes
        await recalculateWbsCodes(allTasks);
        
        // Refresh tasks
        await fetchTasks();
        
        // Expand the new parent to show the updated structure
        setExpandedNodes(prev => new Set(prev).add(newParent.id));
      }
    } catch (err) {
      console.error('Error adding parent:', err);
      setError('Failed to add parent task');
    }
  };

  const handleAddChildInstant = async (taskId: string) => {
    try {
      // Get current task
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      // Get next sort_order for children of this parent
      const { data: lastChild } = await supabase
        .from('tasks')
        .select('sort_order')
        .eq('project_id', selectedProject)
                .eq('parent_id', taskId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (lastChild?.[0]?.sort_order || 0) + 1;

      const now = new Date().toISOString();

      // Generate proper WBS code for the new child
      const { wbsCode: newChildWbsCode } = await generateWbsCode(taskId);
      
      // Create new child task
      const { data: newChild, error: childError } = await supabase
        .from('tasks')
        .insert({
          project_id: selectedProject,
          parent_id: taskId,
          level: currentTask.level + 1,
          task_name: 'New Child',
          wbs_code: newChildWbsCode,
          sort_order: nextSortOrder,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (childError || !newChild) {
        setError(`Failed to create child: ${childError?.message || 'Unknown error'}`);
        return;
      }

      // Add a small delay to ensure the new child is saved to database
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get all tasks for WBS recalculation (including the new child)
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      if (allTasks) {
        console.log('Total tasks before recalculation:', allTasks.length);
        console.log('New child created:', newChild);
        
        // Recalculate all WBS codes
        await recalculateWbsCodes(allTasks);
        
        // Add a delay to ensure database updates are complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Refresh tasks
        await fetchTasks();
        
        // Verify the new child has proper WBS code
        const { data: updatedChild } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', newChild.id)
          .single();
        
        console.log('Updated child after recalculation:', updatedChild);
        
        // Expand the parent to show the new child
        setExpandedNodes(prev => new Set(prev).add(taskId));
        
        console.log('Child creation and WBS recalculation completed');
      }
    } catch (err) {
      console.error('Error adding child:', err);
      setError('Failed to add child task');
    }
  };

  const handleMoveUp = async (taskId: string) => {
    try {
      // Get current task and all siblings
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      // Get all siblings (same parent_id) ordered by sort_order
      let siblingsQuery = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      // Handle null parent_id properly
      if (currentTask.parent_id === null) {
        siblingsQuery = siblingsQuery.is('parent_id', null);
      } else {
        siblingsQuery = siblingsQuery.eq('parent_id', currentTask.parent_id);
      }

      const { data: siblings } = await siblingsQuery
        .order('sort_order', { ascending: true });

      if (!siblings || siblings.length < 2) {
        setError('No siblings to move with');
        return;
      }

      // Find current task index and previous sibling
      const currentIndex = siblings.findIndex(t => t.id === taskId);
      if (currentIndex <= 0) {
        setError('Already at the top');
        return;
      }

      const previousSibling = siblings[currentIndex - 1];
      
      // Swap sort_order values
      const now = new Date().toISOString();
      const { error: updateError1 } = await supabase
        .from('tasks')
        .update({
          sort_order: previousSibling.sort_order,
          updated_at: now
        })
        .eq('id', taskId);

      const { error: updateError2 } = await supabase
        .from('tasks')
        .update({
          sort_order: currentTask.sort_order,
          updated_at: now
        })
        .eq('id', previousSibling.id);

      if (updateError1 || updateError2) {
        setError('Failed to reorder tasks');
        return;
      }

      // Refresh tasks
      await fetchTasks();
    } catch (err) {
      console.error('Error moving task up:', err);
      setError('Failed to move task up');
    }
  };

  const handleMoveDown = async (taskId: string) => {
    try {
      // Get current task and all siblings
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      // Get all siblings (same parent_id) ordered by sort_order
      let siblingsQuery = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      // Handle null parent_id properly
      if (currentTask.parent_id === null) {
        siblingsQuery = siblingsQuery.is('parent_id', null);
      } else {
        siblingsQuery = siblingsQuery.eq('parent_id', currentTask.parent_id);
      }

      const { data: siblings } = await siblingsQuery
        .order('sort_order', { ascending: true });

      if (!siblings || siblings.length < 2) {
        setError('No siblings to move with');
        return;
      }

      // Find current task index and next sibling
      const currentIndex = siblings.findIndex(t => t.id === taskId);
      if (currentIndex >= siblings.length - 1) {
        setError('Already at the bottom');
        return;
      }

      const nextSibling = siblings[currentIndex + 1];
      
      // Swap sort_order values
      const now = new Date().toISOString();
      const { error: updateError1 } = await supabase
        .from('tasks')
        .update({
          sort_order: nextSibling.sort_order,
          updated_at: now
        })
        .eq('id', taskId);

      const { error: updateError2 } = await supabase
        .from('tasks')
        .update({
          sort_order: currentTask.sort_order,
          updated_at: now
        })
        .eq('id', nextSibling.id);

      if (updateError1 || updateError2) {
        setError('Failed to reorder tasks');
        return;
      }

      // Refresh tasks
      await fetchTasks();
    } catch (err) {
      console.error('Error moving task down:', err);
      setError('Failed to move task down');
    }
  };

  const parseWbsCode = (wbsCode: string): { level: number; parentCode: string } => {
    const parts = wbsCode.split('.');
    const level = parts.length;
    const parentCode = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
    return { level, parentCode };
  };

  const findParentByWbsCode = async (wbsCode: string, projectId: string): Promise<Task | null> => {
    const { data: parentTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('wbs_code', wbsCode)
      .single();
    
    return parentTask || null;
  };

  const restructureWbsTree = async (taskId: string, newWbsCode: string) => {
    try {
      // Get current task to preserve original parent_id if needed
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask) {
        setError('Task not found');
        return;
      }

      const { level: newLevel, parentCode } = parseWbsCode(newWbsCode);
      
      // Find parent task based on parent code
      let parentTask: Task | null = null;
      let parentMissing = false;
      let finalParentId = currentTask.parent_id; // Default to current parent_id

      if (parentCode) {
        parentTask = await findParentByWbsCode(parentCode, selectedProject);
        if (!parentTask) {
          parentMissing = true;
          // Keep original parent_id when parent is missing
          console.warn(`Parent task with WBS code ${parentCode} not found, keeping original parent_id`);
        } else {
          // Use found parent's ID
          finalParentId = parentTask.id;
        }
      }

      // Get all tasks for WBS recalculation
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', selectedProject)
        ;

      if (allTasks) {
        // Recalculate all WBS codes
        await recalculateWbsCodes(allTasks);
        
        // Refresh tasks
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error restructuring WBS tree:', err);
      setError('Failed to restructure WBS tree');
    }
  };

  const renderTaskTree = (tasks: Task[], level = 0) => {
    return tasks.map(task => (
      <div key={task.id} className="border-l-2 border-gray-200 dark:border-gray-700" style={{ marginLeft: `${level * 20}px` }}>
        <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            {task.children && task.children.length > 0 && (
              <button
                onClick={() => toggleExpand(task.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expandedNodes.has(task.id) ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                {task.wbs_code}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {task.task_name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Level {task.level}
              </span>
              {task.parent_missing && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  parent task missing
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddChildInstant(task.id)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-sm"
              title="Create child task instantly below this task"
            >
              + Add Child
            </button>
            <button
              onClick={() => handleAddParent(task.id)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-sm"
              title="Insert parent above this task"
            >
              + Add Parent
            </button>
            <button
              onClick={() => handleMoveUp(task.id)}
              className="text-teal-600 dark:text-teal-400 hover:text-teal-800 text-sm"
              title="Move up within same level"
            >
              ↑ Up
            </button>
            <button
              onClick={() => handleMoveDown(task.id)}
              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 text-sm"
              title="Move down within same level"
            >
              ↓ Down
            </button>
            <button
              onClick={() => handleIndent(task.id)}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 text-sm"
              title="Make child of previous task"
            >
              → Indent
            </button>
            <button
              onClick={() => handleOutdent(task.id)}
              className="text-orange-600 dark:text-orange-400 hover:text-orange-800 text-sm"
              title="Move up one level"
            >
              ← Outdent
            </button>
            <button
              onClick={() => handleEditTask(task)}
              className="text-green-600 dark:text-green-400 hover:text-green-800 text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => deleteTask(task.id)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          </div>
        </div>
        {expandedNodes.has(task.id) && task.children && (
          <div>
            {renderTaskTree(task.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const getAvailableParents = () => {
    // When editing, exclude the current task from parent options to prevent circular references
    if (editingTask) {
      return tasks.filter(task => task.id !== editingTask.id);
    }
    // When creating, show all tasks as potential parents
    return tasks;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                WBS Planning
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Work Breakdown Structure Management
              </p>
              {userName && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  User: {userName}
                </p>
              )}
              {organizationName && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Organization: {organizationName}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/org-dashboard')}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>

          {/* Project Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name}
                </option>
              ))}
            </select>
          </div>

          {/* Zone Selection */}
          {selectedProject && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Zone
              </label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a zone...</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              {zones.length === 0 && (
                <div className="mt-2">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                    No zones found for this project.
                  </p>
                  <button
                    onClick={() => {
                      const zoneName = prompt('Enter zone name:');
                      if (zoneName && zoneName.trim()) {
                        createZone(zoneName.trim());
                      }
                    }}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Create First Zone
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedProject && selectedZone && (
            <>
              {/* Action Buttons */}
              <div className="mb-6 flex gap-4">
                <button
                  onClick={() => {
                    setNewTask({ task_name: '', parent_id: '' });
                    setEditingTask(null);
                    setShowCreateForm(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Add Root Task
                </button>
                <button
                  onClick={fixExistingWbsCodes}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Fix WBS Codes
                </button>
              </div>

              {/* Create/Edit Task Form - Modal-Inline Form Pattern */}
              {showCreateForm && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 border-2 border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingTask ? 'Edit Task' : 'Create New Task'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingTask(null);
                        setNewTask({ task_name: '', parent_id: '' });
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {editingTask && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Editing: {editingTask.wbs_code} - {editingTask.task_name}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Task Name *
                      </label>
                      <input
                        type="text"
                        value={newTask.task_name}
                        onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter task name"
                        autoFocus
                      />
                    </div>

                    {editingTask && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          WBS Code *
                        </label>
                        <input
                          type="text"
                          value={editingTask.wbs_code}
                          onChange={(e) => setEditingTask({ ...editingTask, wbs_code: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter WBS code (e.g., 1, 1.1, 1.1.1)"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Changing WBS code will restructure the entire hierarchy
                        </p>
                      </div>
                    )}
                    
                    {!editingTask && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Parent Task (Optional)
                        </label>
                        <select
                          value={newTask.parent_id || ''}
                          onChange={(e) => setNewTask({ ...newTask, parent_id: e.target.value || null })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Root Task</option>
                          {getAvailableParents().map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.wbs_code} - {task.task_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={editingTask ? updateTask : createTask}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {editingTask ? 'Update Task' : 'Create Task'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateForm(false);
                          setEditingTask(null);
                          setNewTask({ task_name: '', parent_id: '' });
                          setError(null);
                        }}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks Tree */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      WBS Structure
                    </h3>
                    {tasks.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={expandAll}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                          title="Expand all tasks"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                        <button
                          onClick={collapseAll}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                          title="Collapse all tasks"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedZone && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Zone: {zones.find(z => z.id === selectedZone)?.name || 'Unknown'}
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-600 dark:text-red-400 text-center py-8">
                    {error}
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No tasks found. Create your first task to get started.
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto space-y-2">
                    {renderTaskTree(buildTaskTree(tasks))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
