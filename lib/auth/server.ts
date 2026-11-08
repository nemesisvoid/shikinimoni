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
