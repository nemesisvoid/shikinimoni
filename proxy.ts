import { auth } from '@/lib/auth/server';

// Runs only on the admin and agent areas (see `matcher`): signed-out visitors are sent to
// sign-in, and the session is refreshed on the way through. Everything else is
// a public site, so the proxy stays out of the way and an unknown URL shows the
// normal 404 page instead of a sign-in prompt.
//
// This is a convenience, not the security check: every admin page calls
// requireAdminPage() and every admin Server Action calls assertAdmin()
// (lib/auth/guards.ts), which also check the admin role. Add any new
// signed-in-only area to the matcher below.
export default auth.middleware({ loginUrl: '/auth/sign-in' });

export const config = {
  matcher: ['/admin', '/admin/:path*', '/agent', '/agent/:path*'],
};
