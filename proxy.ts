import { auth } from '@/lib/auth/server';

// Page protection only. Every PAGE requires a session except those listed in
// publicRoutes (each entry also covers its sub-paths); the /auth/* sign-in views
// are public by default. This is a public listings site, so add each new public
// page here, e.g. "/properties".
//
// /api/* is excluded from the matcher: API routes return JSON 401/403 from their
// own guards (lib/auth/guards.ts) instead of redirecting to the sign-in page.
// Role checks (admin) are never done here; always use requireAdmin().
export default auth.middleware({
  loginUrl: '/auth/sign-in',
  // Each entry also covers its sub-paths ("/properties" includes every property page).
  // robots.txt, the sitemap and the share image must stay reachable for crawlers.
  publicRoutes: ['/', '/contact', '/properties', '/robots.txt', '/sitemap.xml', '/opengraph-image'],
});

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
