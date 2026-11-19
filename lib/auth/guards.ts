import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "./server";

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.getSession>>["data"]
>["user"];

/** The signed-in user, or null. Reads cookies, so the caller renders at request time. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Opt out of prerendering here, before @neon/auth reads cookies; otherwise the
  // SDK catches and logs Next's prerender bail-out as a cookie error at build time.
  await connection();
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

/**
 * App roles. `neon_auth.user.role` is a text column owned by Neon Auth (not a
 * Postgres enum), and Better Auth's admin plugin stores multiple roles as a
 * comma-separated string ("user,admin"), so the type lives here, not in Prisma.
 */
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Parse the raw role column into known roles; unknown values are ignored. */
export function parseRoles(raw: string | null | undefined): Role[] {
  return (raw ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r));
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  if (!user) return false;
  const { role: raw, banned } = user as { role?: string | null; banned?: boolean | null };
  if (banned) return false;
  return parseRoles(raw).includes(role);
}

/** Banned users never count as admins. */
export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, "admin");
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin guards. `proxy.ts` only redirects signed-out page visits; it never
// checks roles, and Route Handlers and Server Actions can be called directly
// with a POST, so every admin entry point must call one of these itself.
// ─────────────────────────────────────────────────────────────────────────────

export type AuthorizationCode = "UNAUTHORIZED" | "FORBIDDEN";

const AUTHORIZATION_MESSAGES: Record<AuthorizationCode, string> = {
  UNAUTHORIZED: "Sign in to continue.",
  FORBIDDEN: "You need an admin account to do that.",
};

/** Thrown by assertAdmin(). `code` says whether to sign in or that the role is missing. */
export class AuthorizationError extends Error {
  readonly code: AuthorizationCode;
  constructor(code: AuthorizationCode) {
    super(AUTHORIZATION_MESSAGES[code]);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * The one place the admin rule lives; every guard below delegates to it.
 *
 * The session comes from a signed cookie that Neon Auth caches for up to five
 * minutes, so its role and name can be stale. Role, ban and name are read from
 * neon_auth.user instead: removing someone's admin access takes effect on their
 * next request, and a renamed admin sees the new name at once.
 */
async function checkAdmin(): Promise<{ user: SessionUser } | { code: AuthorizationCode }> {
  const session = await getCurrentUser();
  if (!session) return { code: "UNAUTHORIZED" };
  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, role: true, banned: true },
  });
  if (!row) return { code: "UNAUTHORIZED" };
  const user = { ...session, name: row.name, role: row.role, banned: row.banned } as SessionUser;
  if (!isAdmin(user)) return { code: "FORBIDDEN" };
  return { user };
}

/** True only for a signed-in admin, checked against the database. Never throws. */
export async function currentUserIsAdmin(): Promise<boolean> {
  return "user" in (await checkAdmin());
}

/**
 * For Server Actions (and any server code that should stop on failure).
 * Returns the admin user, or throws AuthorizationError.
 *
 * Call it OUTSIDE any try/catch that swallows errors, or rethrow it:
 *
 *   const admin = await assertAdmin();
 *   await prisma.property.create({ data: { ...input, createdById: admin.id } });
 */
export async function assertAdmin(): Promise<SessionUser> {
  const result = await checkAdmin();
  if ("code" in result) throw new AuthorizationError(result.code);
  return result.user;
}

/**
 * For admin PAGES. Signed out → sign-in page (then back here); signed in but not
 * an admin → 404, so the admin area doesn't advertise itself. Call it at the top
 * of every admin page: layouts don't re-run on client navigation, so a check in
 * the admin layout alone isn't enough.
 */
export async function requireAdminPage(returnTo: string): Promise<SessionUser> {
  const result = await checkAdmin();
  if ("code" in result) {
    if (result.code === "UNAUTHORIZED") redirect(`/auth/sign-in?redirectTo=${encodeURIComponent(returnTo)}`);
    notFound();
  }
  return result.user;
}

type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

/**
 * For Route Handlers. Never throws; returns a ready-made JSON 401/403:
 *
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 */
export async function requireAdmin(): Promise<GuardResult> {
  const result = await checkAdmin();
  if ("code" in result) {
    const status = result.code === "UNAUTHORIZED" ? 401 : 403;
    return { ok: false, response: Response.json({ error: AUTHORIZATION_MESSAGES[result.code] }, { status }) };
  }
  return { ok: true, user: result.user };
}
