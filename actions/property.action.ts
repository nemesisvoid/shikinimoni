'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseInput, type FieldErrors } from '@/schemas/form-data';
import { uuid } from '@/schemas/fields';
import { CreatePropertySchema, type CreatePropertyInput } from '@/schemas/property.schema';

export type SavePropertyResult =
  | { ok: true; data: { id: string; slug: string } }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const SLUG_MAX = 200;
const NEEDS_ATTENTION = 'Some fields need attention.';
const SAVE_FAILED = "The property couldn't be saved. Try again in a moment.";

/**
 * Creates a listing from the property form's values (the raw input, validated
 * here again with the same schema the browser used). Photos and documents are
 * uploaded afterwards against the returned id.
 *
 * Web address: if the admin typed one and it's taken, they get a field error.
 * If it was generated from the name, a free one is picked ("-2", "-3", …).
 */
export async function createProperty(input: unknown): Promise<SavePropertyResult> {
  // Throws for signed-out / non-admin callers. Outside the try/catch on purpose.
  const admin = await assertAdmin();

  const checked = await checkInput(input);
  if (!checked.ok) return checked;
  const { data, amenityIds, slugWasTyped } = checked;

  let slug = data.slug;
  if (slugWasTyped) {
    if (await slugTaken(slug)) return slugError();
  } else {
    slug = await freeSlug(slug);
  }

  // Two admins saving the same name at once can still clash; retry with a new suffix.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const property = await prisma.$transaction(async (tx) => {
        const created = await tx.property.create({
          data: {
            ...data,
            slug,
            publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
            createdById: admin.id,
            updatedById: admin.id,
            amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
          },
          select: { id: true, slug: true },
        });
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'Property',
            entityId: created.id,
            changes: { name: data.name, status: data.status },
            actorId: admin.id,
          },
        });
        return created;
      });

      revalidateListings(data.status === 'PUBLISHED');
      return { ok: true, data: property };
    } catch (error) {
      if (isUniqueSlugError(error)) {
        if (slugWasTyped) return slugError();
        slug = await freeSlug(data.slug);
        continue;
      }
      console.error('createProperty failed:', error);
      return { ok: false, error: SAVE_FAILED };
    }
  }
  return { ok: false, error: SAVE_FAILED };
}

/**
 * Saves the edit form. Takes the full set of form values (same rules as
 * create), replaces the amenity list, and records which fields changed.
 *
 * Web address: kept as is unless the admin changes it. Clearing it regenerates
 * one from the name.
 */
export async function updateProperty(input: unknown): Promise<SavePropertyResult> {
  const admin = await assertAdmin();

  const id = uuid('property id').safeParse((input as { id?: unknown } | null)?.id);
  if (!id.success) return { ok: false, error: 'That property no longer exists.' };
  const propertyId = id.data;

  const checked = await checkInput((input as { values?: unknown }).values);
  if (!checked.ok) return checked;
  const { data, amenityIds, slugWasTyped } = checked;

  const existing = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
    include: { amenities: { select: { amenityId: true } } },
  });
  if (!existing) return { ok: false, error: 'That property no longer exists. It may have been deleted.' };

  let slug = data.slug;
  if (slug !== existing.slug) {
    if (slugWasTyped) {
      if (await slugTaken(slug, propertyId)) return slugError();
    } else {
      slug = await freeSlug(slug, propertyId);
    }
  }

  const goesLive = data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';
  const changes = diff(existing, { ...data, slug });
  const oldAmenities = existing.amenities.map((a) => a.amenityId).sort((a, b) => a - b);
  const newAmenities = [...amenityIds].sort((a, b) => a - b);
  if (oldAmenities.join() !== newAmenities.join()) changes.amenityIds = { from: oldAmenities, to: newAmenities };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          ...data,
          slug,
          ...(goesLive ? { publishedAt: new Date() } : {}),
          updatedById: admin.id,
        },
      });
      if ('amenityIds' in changes) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId } });
        await tx.propertyAmenity.createMany({ data: amenityIds.map((amenityId) => ({ propertyId, amenityId })) });
      }
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            action: goesLive
              ? 'PUBLISH'
              : existing.status === 'PUBLISHED' && data.status !== 'PUBLISHED'
                ? 'UNPUBLISH'
                : 'UPDATE',
            entityType: 'Property',
            entityId: propertyId,
            changes: changes as Prisma.InputJsonValue,
            actorId: admin.id,
          },
        });
      }
    });
  } catch (error) {
    if (isUniqueSlugError(error)) return slugError();
    console.error('updateProperty failed:', error);
    return { ok: false, error: SAVE_FAILED };
  }

  revalidateListings(data.status === 'PUBLISHED' || existing.status === 'PUBLISHED');
  return { ok: true, data: { id: propertyId, slug } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type CheckedInput =
  | { ok: true; data: Omit<CreatePropertyInput, 'amenityIds'> & { slug: string }; amenityIds: number[]; slugWasTyped: boolean }
  | { ok: false; error: string; fieldErrors: FieldErrors };

async function checkInput(input: unknown): Promise<CheckedInput> {
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

function slugError(): SavePropertyResult {
  return { ok: false, error: NEEDS_ATTENTION, fieldErrors: { slug: ['Another property already uses this web address'] } };
}

/** Soft-deleted listings keep their slug (the column is unique), so they count too. */
async function slugTaken(slug: string, excludeId?: string) {
  return (await prisma.property.count({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
}

/** "lekki-duplex" → "lekki-duplex", or "lekki-duplex-2", "-3", … if taken. */
async function freeSlug(base: string, excludeId?: string) {
  const rows = await prisma.property.findMany({
    where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { slug: true },
  });
  const taken = new Set(rows.map((r) => r.slug));
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
function isUniqueSlugError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  return JSON.stringify(error.meta ?? {}).includes('slug');
}

/** { price: { from: "85000000", to: "80000000" } } for the fields that changed. */
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const plain = (v: unknown) => (v instanceof Prisma.Decimal ? v.toNumber() : v instanceof Date ? v.toISOString() : v ?? null);
  for (const [key, value] of Object.entries(after)) {
    const from = plain(before[key]);
    const to = plain(value);
    if (String(from) !== String(to)) changes[key] = { from, to };
  }
  return changes;
}

function revalidateListings(touchesPublicSite: boolean) {
  revalidatePath('/admin', 'layout');
  if (touchesPublicSite) revalidatePath('/', 'layout');
}
