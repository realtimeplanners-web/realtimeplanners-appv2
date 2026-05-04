import { supabase } from '../app/lib/supabase';

export interface IssueData {
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'bug' | 'feature' | 'improvement' | 'ui' | 'performance' | 'security' | 'general';
  page_url?: string;
  user_email?: string;
  screenshot_url?: string;
  error_details?: any;
}

export class IssueReporter {
  // Report an issue from anywhere in the app
  static async reportIssue(issueData: IssueData): Promise<boolean> {
    try {
      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      // Get current user if available
      let userEmail = issueData.user_email || 'anonymous@example.com';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          userEmail = user.email;
        }
      } catch (error) {
        // User not authenticated, continue with anonymous
      }

      const { error } = await supabase
        .from("issues")
        .insert({
          title: issueData.title,
          description: issueData.description || '',
          severity: issueData.severity || 'medium',
          category: issueData.category || 'general',
          page_url: issueData.page_url || window.location.href,
          user_email: userEmail,
          screenshot_url: issueData.screenshot_url,
          browser_info: JSON.stringify(browserInfo),
          error_details: issueData.error_details ? JSON.stringify(issueData.error_details) : null,
        });

      if (error) {
        console.error("Error reporting issue:", error);
        return false;
      }

      console.log("Issue reported successfully");
      return true;
    } catch (err) {
      console.error("Exception reporting issue:", err);
      return false;
    }
  }

  // Report JavaScript errors automatically
  static setupGlobalErrorReporting(): void {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportIssue({
        title: `JavaScript Error: ${event.message}`,
        description: `Error occurred at ${event.filename}:${event.lineno}:${event.colno}`,
        severity: 'high',
        category: 'bug',
        error_details: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        },
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportIssue({
        title: `Unhandled Promise Rejection: ${event.reason}`,
        description: `Promise rejected with: ${event.reason}`,
        severity: 'high',
        category: 'bug',
        error_details: {
          reason: event.reason,
          stack: event.reason?.stack,
        },
      });
    });
  }

  // Capture screenshot and report issue
  static async captureScreenshotAndReport(issueData: IssueData): Promise<boolean> {
    try {
      // Use html2canvas or similar library for screenshot capture
      // For now, we'll just report without screenshot
      return await this.reportIssue(issueData);
    } catch (err) {
      console.error("Error capturing screenshot:", err);
      // Fallback to reporting without screenshot
      return await this.reportIssue(issueData);
    }
  }

  // Report API errors
  static async reportApiError(
    error: any, 
    endpoint: string, 
    method: string, 
    requestData?: any
  ): Promise<boolean> {
    return this.reportIssue({
      title: `API Error: ${endpoint}`,
      description: `${method} request to ${endpoint} failed`,
      severity: 'high',
      category: 'bug',
      error_details: {
        endpoint,
        method,
        requestData,
        error: error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Report performance issues
  static async reportPerformanceIssue(
    metricName: string, 
    value: number, 
    threshold: number
  ): Promise<boolean> {
    return this.reportIssue({
      title: `Performance Issue: ${metricName}`,
      description: `${metricName} is ${value}ms (threshold: ${threshold}ms)`,
      severity: value > threshold * 2 ? 'critical' : 'high',
      category: 'performance',
      error_details: {
        metricName,
        value,
        threshold,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Report UI/UX issues
  static async reportUIIssue(
    component: string, 
    issue: string, 
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    return this.reportIssue({
      title: `UI Issue: ${component}`,
      description: issue,
      severity,
      category: 'ui',
      error_details: {
        component,
        issue,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Initialize global error reporting
if (typeof window !== 'undefined') {
  IssueReporter.setupGlobalErrorReporting();
}

// Export convenience functions
export const reportIssue = IssueReporter.reportIssue.bind(IssueReporter);
export const reportApiError = IssueReporter.reportApiError.bind(IssueReporter);
export const reportPerformanceIssue = IssueReporter.reportPerformanceIssue.bind(IssueReporter);
export const reportUIIssue = IssueReporter.reportUIIssue.bind(IssueReporter);
