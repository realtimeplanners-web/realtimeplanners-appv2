// Supabase configuration for pictorial module
// This should match your main app's Supabase configuration

// Get Supabase config from environment variables or window object
const SUPABASE_URL = window.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Make these available globally for the pictorial module
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

console.log('Supabase config loaded for pictorial module');
