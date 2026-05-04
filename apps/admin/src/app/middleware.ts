import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // Create Supabase client with proper cookie handling
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        cookie: req.headers.get('cookie') || '',
      },
    },
  })

  // Check for session using getUser for better validation
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  // Define protected routes and their required roles
  const protectedRoutes = {
    '/super-admin': 'super_admin',
    '/org-admin': 'org_admin',
    '/org-dashboard': 'org_admin',
    '/user-dashboard': 'user',
    '/project-details': 'user', // Any authenticated user can access
    '/activities': 'user',
    '/projects': 'user',
    '/planning': 'user',
    '/qs': 'user',
    '/issues': 'user',
    '/pictorial': 'user',
    '/pictorial-test': 'user',
    '/project-dashboard': 'user',
    '/projects-list': 'user'
  }
  
  const publicRoutes = ['/', '/login', '/register']
  const { pathname } = req.nextUrl

  // Check if the current path is a protected route
  const isProtectedRoute = Object.keys(protectedRoutes).some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.includes(pathname)

  // If user is not authenticated and trying to access protected route
  if (!user || userError) {
    if (isProtectedRoute) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return res
  }

  // If user is authenticated, check role-based access
  if (user && isProtectedRoute) {
    // Fetch user role from database
    try {
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (roleError || !userData) {
        console.error('Error fetching user role:', roleError)
        const url = req.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }

      // Check if user has required role for the route
      const matchedRoute = Object.keys(protectedRoutes).find(route => pathname.startsWith(route))
      if (matchedRoute) {
        const allowedRole = protectedRoutes[matchedRoute as keyof typeof protectedRoutes]
        
        // Super admin can access everything
        if (userData.role !== 'super_admin' && userData.role !== allowedRole) {
          console.error(`Access denied: User role ${userData.role} not allowed for ${matchedRoute}`)
          const url = req.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
      }
    } catch (error) {
      console.error('Exception during auth check:', error)
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // If user is authenticated and trying to access public routes (except root)
  if (user && isPublicRoute && pathname !== '/') {
    const url = req.nextUrl.clone()
    // Redirect based on user role
    try {
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (!roleError && userData) {
        if (userData.role === 'super_admin') {
          url.pathname = '/super-admin'
        } else if (userData.role === 'org_admin') {
          url.pathname = '/org-admin'
        } else {
          url.pathname = '/user-dashboard'
        }
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Error fetching user role for redirect:', error)
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
