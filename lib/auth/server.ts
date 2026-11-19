import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl) {
  throw new Error("NEON_AUTH_BASE_URL is not set. Run `neon env pull` to populate .env.local.");
}
if (!secret || secret.length < 32) {
  throw new Error("NEON_AUTH_COOKIE_SECRET must be set to 32+ characters (openssl rand -base64 32).");
}

// Neon Auth = Managed Better Auth. Neon hosts the auth server; this instance
// proxies /api/auth/* to it, caches the session in a signed cookie, and exposes
// the Better Auth server methods (getSession, admin.*, ...).
export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret },
});

type AuthCallResult = { data: unknown; error: { status: number; code?: string; message: string } | null };

/**
 * The admin-plugin calls this app uses. @neon/auth 0.8 types `auth.admin` as
 * `unknown`, though it proxies every admin endpoint at runtime, so the calls
 * are typed here. They run as the signed-in user; Neon Auth checks that
 * they're an admin.
 */
export const authAdmin = auth.admin as {
  setRole(args: { userId: string; role: 'user' | 'admin' }): Promise<AuthCallResult>;
};
