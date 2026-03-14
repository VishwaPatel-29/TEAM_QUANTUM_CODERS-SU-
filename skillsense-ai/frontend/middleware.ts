// frontend/middleware.ts
// Next.js Edge Middleware — enforces route protection and role-based access.
// Runs on the server/edge before a page is rendered.
// Reads `skillsense_token` and `skillsense_role` cookies (set by lib/auth.ts on login).

import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/admin', '/student', '/institute', '/industry', '/government'];

// Role-to-allowed-prefix map: key = cookie role value, value = array of allowed route prefixes
const ROLE_ROUTES: Record<string, string[]> = {
  admin:      ['/admin', '/student', '/institute', '/industry', '/government'],
  student:    ['/student'],
  institute:  ['/institute'],
  industry:   ['/industry'],
  government: ['/government'],
};

// Public routes — always accessible
const PUBLIC_PREFIXES = ['/auth', '/api', '/_next', '/favicon', '/icon'];

const isPublic = (pathname: string): boolean =>
  PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === '/';

const isProtected = (pathname: string): boolean =>
  PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always allow public routes through
  if (isPublic(pathname)) return NextResponse.next();

  // Only gate on protected paths
  if (!isProtected(pathname)) return NextResponse.next();

  const token = request.cookies.get('skillsense_token')?.value;
  const role  = request.cookies.get('skillsense_role')?.value;

  // 1. Not authenticated → redirect to /auth
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated but wrong role → redirect to their own dashboard
  if (role) {
    const allowed = ROLE_ROUTES[role] ?? [];
    const hasAccess = allowed.some((p) => pathname.startsWith(p));

    if (!hasAccess) {
      const homeUrl = request.nextUrl.clone();
      // Redirect to their role's root dashboard
      homeUrl.pathname = `/${role}`;
      homeUrl.search = '';
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png).*)'],
};
