import { supabase } from './supabase'

export const handleLogout = async () => {
  try {
    console.log('Starting logout process...')
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out from Supabase:', error)
    } else {
      console.log('Successfully signed out from Supabase')
    }
    
    // Clear all local storage
    try {
      localStorage.clear()
      console.log('Cleared localStorage')
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
    
    // Clear all session storage
    try {
      sessionStorage.clear()
      console.log('Cleared sessionStorage')
    } catch (error) {
      console.error('Error clearing sessionStorage:', error)
    }
    
    // Clear all cookies
    try {
      document.cookie.split(";").forEach((c) => {
        const cookie = c.trim()
        if (cookie.length > 0) {
          document.cookie = cookie
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/;domain=" + window.location.hostname)
        }
      })
      console.log('Cleared all cookies')
    } catch (error) {
      console.error('Error clearing cookies:', error)
    }
    
    // Force redirect to login page
    console.log('Redirecting to login page...')
    window.location.href = "/"
    
  } catch (error) {
    console.error('Exception during logout:', error)
    // Force redirect even if logout fails
    window.location.href = "/"
  }
}
