import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { currentUserIsAdmin } from '@/lib/auth/guards';
import { uuid } from '@/schemas/fields';

/** Crawlers, link previews and test browsers. They aren't people looking at a listing. */
const NOT_A_VISITOR = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pagespeed/i;

/**
 * Counts one view of a published listing, sent by the listing page's beacon
 * (components/listing/view-beacon.tsx) at most once per browser per day.
 * Only a daily total per listing is stored: no IP address, cookie or visitor id.
 * Admins looking at their own listings aren't counted.
 */
export async function POST(request: NextRequest) {
  const done = new Response(null, { status: 204 });
  if (NOT_A_VISITOR.test(request.headers.get('user-agent') ?? '')) return done;

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done;
  }
  const id = uuid().safeParse((body as { id?: unknown } | null)?.id);
  if (!id.success) return done;

  const signedIn = request.cookies.getAll().some(c => c.name.startsWith('__Secure-neon-auth'));
  if (signedIn && (await currentUserIsAdmin())) return done;

  try {
    // Only published, live listings count. `updatedAt` is left alone (it's set by Prisma, not the database).
    await prisma.$executeRaw`
      WITH listing AS (
        UPDATE "properties" SET "viewCount" = "viewCount" + 1
        WHERE "id" = ${id.data}::uuid AND "status" = 'PUBLISHED' AND "deletedAt" IS NULL
        RETURNING "id"
      )
      INSERT INTO "property_view_days" ("propertyId", "day", "views")
      SELECT "id", (now() AT TIME ZONE 'Africa/Lagos')::date, 1 FROM listing
      ON CONFLICT ("propertyId", "day") DO UPDATE SET "views" = "property_view_days"."views" + 1`;
  } catch (error) {
    console.error('Counting a listing view failed:', error);
  }
  return done;
}
