import { supabase } from '../app/lib/supabase';

interface ErrorLogData {
  title: string;
  description: string;
  severity: string;
  category: string;
  error_details?: any;
}

// Helper function to log issues to the database
async function logIssue(data: ErrorLogData): Promise<void> {
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      console.log("🔍 DEBUG: logIssue called on server side, skipping");
      return;
    }

    console.log("🔍 DEBUG: logIssue called with data:", data);

    // Get browser info
    const browserInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Get current user if available (non-blocking)
    let userEmail = 'anonymous@example.com';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        userEmail = user.email;
      }
    } catch (error) {
      // User not authenticated, continue with anonymous
    }

    // Insert issue into database (non-blocking)
    console.log("🔍 DEBUG: Attempting to insert issue into database...");
    try {
      const insertData = {
        title: data.title,
        description: data.description,
        severity: data.severity,
        category: data.category,
        page_url: window.location.href,
        user_email: userEmail,
        browser_info: JSON.stringify(browserInfo),
        error_details: data.error_details ? JSON.stringify(data.error_details) : null,
      };
      
      console.log("🔍 DEBUG: Insert data:", insertData);
      
      const { error, data: result } = await supabase
        .from('issues')
        .insert([insertData])
        .select();
      
      if (error) {
        console.error('🔍 DEBUG: Error logging failed:', error);
        console.error('🔍 DEBUG: Error details:', error.details);
        console.error('🔍 DEBUG: Error code:', error.code);
      } else {
        console.log('🔍 DEBUG: Error logged successfully:', data.title);
        console.log('🔍 DEBUG: Insert result:', result);
      }
    } catch (e: any) {
      console.error('🔍 DEBUG: Exception in error logging:', e);
    }

  } catch (e) {
    console.error('Error logging failed:', e);
  }
}

// Global error handler for JavaScript errors
async function handleJavaScriptError(
  message: string,
  source: string,
  lineno: number,
  colno: number,
  error?: Error
): Promise<void> {
  await logIssue({
    title: 'JavaScript Error',
    description: message,
    severity: 'high',
    category: 'bug',
    error_details: {
      type: 'javascript_error',
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    },
  });
}

// Global error handler for unhandled promise rejections
async function handleUnhandledRejection(event: PromiseRejectionEvent): Promise<void> {
  await logIssue({
    title: 'Unhandled Promise Error',
    description: event.reason?.message || 'Promise failed',
    severity: 'high',
    category: 'bug',
    error_details: {
      type: 'unhandled_promise_rejection',
      reason: event.reason,
      message: event.reason?.message,
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
    },
  });
}

// Initialize global error listeners
export function initializeGlobalErrorLogging(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Set up global error handler for JavaScript errors
  window.onerror = async function (message, source, lineno, colno, error) {
    // Don't block the UI
    setTimeout(async () => {
      await handleJavaScriptError(
        message as string,
        source as string,
        lineno as number,
        colno as number,
        error as Error
      );
    }, 0);
    
    // Return false to let the browser handle the error normally
    return false;
  };

  // Set up global error handler for unhandled promise rejections
  window.onunhandledrejection = async function (event) {
    // Don't block the UI
    setTimeout(async () => {
      await handleUnhandledRejection(event);
    }, 0);
    
    // Prevent the default browser behavior
    event.preventDefault();
  };

  console.log('Global error logging initialized');
}

// Export helper function for manual error logging
export { logIssue };

// Export error handlers for manual use
export { handleJavaScriptError, handleUnhandledRejection };
