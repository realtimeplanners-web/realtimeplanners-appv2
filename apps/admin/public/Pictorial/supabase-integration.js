// Supabase integration for pictorial functionality
// Replace Firebase with Supabase for authentication and data storage

// Supabase configuration (should match your main app)
const SUPABASE_URL = window.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client
const { createClient } = supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables for pictorial data
let currentUser = null;
let currentProjectId = null;
let currentZoneId = null;

// Authentication check and user info population
async function checkAuth() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      // Redirect to login or show auth error
      console.log('User not authenticated, using demo mode');
      useDemoMode();
      return;
    }

    currentUser = user;
    populateUserInfo(user);
    return user;
  } catch (error) {
    console.error('Auth check failed:', error);
    useDemoMode();
  }
}

// Demo mode fallback
function useDemoMode() {
  const demoUser = {
    id: 'demo-user',
    email: 'demo@example.com',
    display_name: 'Demo User'
  };
  
  currentUser = demoUser;
  populateUserInfo(demoUser);
  
  // Hide sign out button in demo mode
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.style.display = 'none';
}

// Populate user info in UI
function populateUserInfo(user) {
  const name = user.display_name || user.email?.split('@')[0] || 'Demo User';

  document.getElementById('userName').textContent = name;
  document.getElementById('topbarUserName').textContent = name;

  const lastLogin = user.last_sign_in_at || new Date().toISOString();
  if (lastLogin) {
    const formatted = new Date(lastLogin).toLocaleString(undefined, { 
      dateStyle: 'medium', 
      timeStyle: 'short' 
    });
    document.getElementById('userLastLogin').textContent = 'Last login: ' + formatted;
    document.getElementById('topbarUserDate').textContent = formatted;
  }

  const avatarEl = document.getElementById('userAvatar');
  const topbarAvatarEl = document.getElementById('topbarUserAvatar');
  if (user.user_metadata?.avatar_url) {
    const img = document.createElement('img');
    img.src = user.user_metadata.avatar_url; 
    img.alt = name;
    avatarEl.appendChild(img);
    const img2 = document.createElement('img');
    img2.src = user.user_metadata.avatar_url; 
    img2.alt = name;
    topbarAvatarEl.appendChild(img2);
  } else {
    const initial = name.charAt(0).toUpperCase();
    avatarEl.textContent = initial;
    topbarAvatarEl.textContent = initial;
  }
}

// Sign out functionality
async function signOut() {
  try {
    await supabase.auth.signOut();
    window.location.href = '/'; // Redirect to your main login page
  } catch (error) {
    console.error('Sign out failed:', error);
  }
}

// Get project and zone from URL parameters
function getProjectAndZoneFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  currentProjectId = urlParams.get('project_id');
  currentZoneId = urlParams.get('zone_id');
  
  return { projectId: currentProjectId, zoneId: currentZoneId };
}

// Save page progress to Supabase
async function savePageProgressToSupabase(pageId, canvasData, progressPercentage = 0) {
  if (!currentUser || !currentProjectId) return;

  try {
    const { error } = await supabase
      .from('pictorial_progress')
      .upsert({
        page_id: pageId,
        user_id: currentUser.id,
        progress_data: canvasData,
        progress_percentage: progressPercentage,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'page_id,user_id'
      });

    if (error) throw error;
    console.log('Progress saved to Supabase');
  } catch (error) {
    console.error('Failed to save progress:', error);
    // Fallback to localStorage
    localStorage.setItem(`pp_${pageId}`, canvasData);
  }
}

// Load page progress from Supabase
async function loadPageProgressFromSupabase(pageId) {
  if (!currentUser) return null;

  try {
    const { data, error } = await supabase
      .from('pictorial_progress')
      .select('progress_data')
      .eq('page_id', pageId)
      .eq('user_id', currentUser.id)
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return data?.progress_data || null;
  } catch (error) {
    console.error('Failed to load progress:', error);
    // Fallback to localStorage
    return localStorage.getItem(`pp_${pageId}`);
  }
}

// Save page image to Supabase Storage
async function savePageImageToSupabase(pageId, imageDataUrl) {
  if (!currentUser || !currentProjectId) return;

  try {
    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    
    const fileName = `pictorial_${currentProjectId}_${pageId}_${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('floor-plans')
      .upload(fileName, blob);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('floor-plans')
      .getPublicUrl(fileName);

    // Update page record
    const { error: updateError } = await supabase
      .from('pictorial_pages')
      .update({ floor_plan_url: publicUrl })
      .eq('id', pageId);

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    console.error('Failed to save image:', error);
    // Fallback to localStorage
    localStorage.setItem(`pp_img_${pageId}`, imageDataUrl);
    return imageDataUrl;
  }
}

// Load page image from Supabase
async function loadPageImageFromSupabase(pageId) {
  try {
    const { data, error } = await supabase
      .from('pictorial_pages')
      .select('floor_plan_url')
      .eq('id', pageId)
      .single();

    if (error) throw error;
    
    return data?.floor_plan_url || null;
  } catch (error) {
    console.error('Failed to load image:', error);
    // Fallback to localStorage
    return localStorage.getItem(`pp_img_${pageId}`);
  }
}

// Save page list to Supabase
async function savePageListToSupabase(pages) {
  if (!currentUser || !currentProjectId) return;

  try {
    // This is a simplified version - you might want to implement proper CRUD operations
    for (const page of pages) {
      await supabase
        .from('pictorial_pages')
        .upsert({
          id: page.id,
          project_id: currentProjectId,
          zone_id: currentZoneId,
          name: page.name,
          status: 'active',
          created_by: currentUser.id
        }, {
          onConflict: 'id'
        });
    }
  } catch (error) {
    console.error('Failed to save page list:', error);
    // Fallback to localStorage
    localStorage.setItem('pict_pages', JSON.stringify(pages));
  }
}

// Load page list from Supabase
async function loadPageListFromSupabase() {
  if (!currentUser || !currentProjectId) return [];

  try {
    let query = supabase
      .from('pictorial_pages')
      .select('id, name')
      .eq('project_id', currentProjectId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (currentZoneId) {
      query = query.eq('zone_id', currentZoneId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to load page list:', error);
    // Fallback to localStorage
    const saved = localStorage.getItem('pict_pages');
    return saved ? JSON.parse(saved) : [];
  }
}

// Initialize integration
document.addEventListener('DOMContentLoaded', async () => {
  // Get project/zone from URL
  getProjectAndZoneFromURL();
  
  // Check authentication
  await checkAuth();
  
  // Override original functions to use Supabase
  if (typeof savePageProgress === 'function') {
    const originalSavePageProgress = savePageProgress;
    savePageProgress = async function(pageId) {
      const canvas = document.getElementById(`p-cvs-${pageId}`);
      if (!canvas || !canvas.width) return;
      
      const dataURL = canvas.toDataURL();
      await savePageProgressToSupabase(pageId, dataURL);
      
      // Call original function if it exists
      if (originalSavePageProgress) {
        originalSavePageProgress(pageId);
      }
    };
  }
  
  // Override sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOut);
  }
  
  console.log('Supabase integration loaded');
});

// Export functions for global access
window.pictorialSupabase = {
  savePageProgress: savePageProgressToSupabase,
  loadPageProgress: loadPageProgressFromSupabase,
  savePageImage: savePageImageToSupabase,
  loadPageImage: loadPageImageFromSupabase,
  savePageList: savePageListToSupabase,
  loadPageList: loadPageListFromSupabase,
  currentUser: () => currentUser,
  projectId: () => currentProjectId,
  zoneId: () => currentZoneId
};
