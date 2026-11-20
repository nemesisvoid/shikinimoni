import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { LISTINGS_TAG } from "@/lib/listings/tags";
import { deleteObjects, isStorageConfigured, type BucketKind } from "@/lib/storage/r2";
import { parseInput, type FieldErrors } from "@/schemas/form-data";
import { CreatePropertySchema, type CreatePropertyInput } from "@/schemas/property.schema";

/**
 * Shared by the admin, agent and review actions that write listings: input
 * checks, web-address handling, change tracking and cache refreshes.
 */

export type SavePropertyResult = { ok: true; data: { id: string; slug: string } } | { ok: false; error: string; fieldErrors?: FieldErrors };

const SLUG_MAX = 200;
export const NEEDS_ATTENTION = "Some fields need attention.";
export const SAVE_FAILED = "The property couldn't be saved. Try again in a moment.";

/** Best effort: a leftover file only costs storage, so failures are logged, not shown. */
export async function removeStoredFiles(mediaKeys: string[], documentKeys: string[]) {
  const jobs: [BucketKind, string[]][] = [
    ['media', mediaKeys],
    ['documents', documentKeys],
  ];
  for (const [kind, keys] of jobs) {
    if (keys.length === 0 || !isStorageConfigured(kind)) continue;
    try {
      await deleteObjects(kind, keys);
    } catch (error) {
      console.error(`Removing ${kind} files failed:`, error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export type CheckedInput =
  | { ok: true; data: Omit<CreatePropertyInput, 'amenityIds'> & { slug: string }; amenityIds: number[]; slugWasTyped: boolean }
  | { ok: false; error: string; fieldErrors: FieldErrors };

export async function checkInput(input: unknown): Promise<CheckedInput> {
  const parsed = parseInput(CreatePropertySchema, input);
  if (!parsed.success) return { ok: false, error: NEEDS_ATTENTION, fieldErrors: parsed.fieldErrors };
  const { amenityIds, ...data } = parsed.data;

  const rawSlug = (input as { slug?: unknown } | null)?.slug;
  const slugWasTyped = typeof rawSlug === 'string' && rawSlug.trim() !== '';
  if (!data.slug) {
    return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { name: ['Use letters or numbers in the name'] } };
  }

  if (amenityIds.length > 0) {
    const found = await prisma.amenity.count({ where: { id: { in: amenityIds } } });
    if (found !== amenityIds.length) {
      return {
        ok: false,
        error: NEEDS_ATTENTION,
        fieldErrors: { amenityIds: ['Some of these amenities were removed. Refresh the page and choose again'] },
      };
    }
  }
  return { ok: true, data: { ...data, slug: data.slug }, amenityIds, slugWasTyped };
}

export function slugError(): SavePropertyResult {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { slug: ['Another property already uses this web address'] } };
}

/** Soft-deleted listings keep their slug (the column is unique), so they count too. */
export async function slugTaken(slug: string, excludeId?: string) {
  return (await prisma.property.count({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
}

/** "lekki-duplex" → "lekki-duplex", or "lekki-duplex-2", "-3", … if taken. */
export async function freeSlug(base: string, excludeId?: string) {
  const rows = await prisma.property.findMany({
    where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { slug: true },
  });
  const taken = new Set(rows.map(r => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * P2002 on the slug column. With driver adapters (Neon) the column names sit in
 * meta.driverAdapterError rather than meta.target, so search the whole meta.
 */
export function isUniqueSlugError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  return JSON.stringify(error.meta ?? {}).includes('slug');
}

/** { price: { from: "85000000", to: "80000000" } } for the fields that changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const plain = (v: unknown) => (v instanceof Prisma.Decimal ? v.toNumber() : v instanceof Date ? v.toISOString() : (v ?? null));
  for (const [key, value] of Object.entries(after)) {
    const from = plain(before[key]);
    const to = plain(value);
    if (String(from) !== String(to)) changes[key] = { from, to };
  }
  return changes;
}

export function revalidateListings(touchesPublicSite: boolean) {
  revalidatePath('/admin', 'layout');
  if (touchesPublicSite) {
    // Expires every cached public listing query (lib/listings/queries.ts), so the
    // change shows on the site at once instead of within the hour.
    updateTag(LISTINGS_TAG);
    revalidatePath('/', 'layout');
  }
}
