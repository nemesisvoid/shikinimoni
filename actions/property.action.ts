'use server';

import { after } from 'next/server';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { uuid } from '@/schemas/fields';
import {
  SAVE_FAILED,
  checkInput,
  diff,
  freeSlug,
  isUniqueSlugError,
  removeStoredFiles,
  revalidateListings,
  slugError,
  slugTaken,
  type SavePropertyResult,
} from '@/lib/listings/property-write';

export type { SavePropertyResult } from '@/lib/listings/property-write';

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
      const property = await prisma.$transaction(async tx => {
        const created = await tx.property.create({
          data: {
            ...data,
            slug,
            publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
            createdById: admin.id,
            updatedById: admin.id,
            amenities: { create: amenityIds.map(amenityId => ({ amenityId })) },
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
  const oldAmenities = existing.amenities.map(a => a.amenityId).sort((a, b) => a - b);
  const newAmenities = [...amenityIds].sort((a, b) => a - b);
  if (oldAmenities.join() !== newAmenities.join()) changes.amenityIds = { from: oldAmenities, to: newAmenities };

  try {
    await prisma.$transaction(async tx => {
      await tx.property.update({
        where: { id: propertyId },
        data: {
          ...data,
          slug,
          ...(goesLive ? { publishedAt: new Date() } : {}),
          // An admin publishing (or otherwise moving) an agent's submission from the
          // form settles the review, the same as Approve on the review panel.
          ...(existing.status === 'PENDING_REVIEW' && data.status !== 'PENDING_REVIEW'
            ? { submittedAt: null, reviewedAt: new Date(), reviewNote: null }
            : {}),
          updatedById: admin.id,
        },
      });
      if ('amenityIds' in changes) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId } });
        await tx.propertyAmenity.createMany({ data: amenityIds.map(amenityId => ({ propertyId, amenityId })) });
      }
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            action: goesLive ? 'PUBLISH' : existing.status === 'PUBLISHED' && data.status !== 'PUBLISHED' ? 'UNPUBLISH' : 'UPDATE',
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
// Archive, delete, restore
// ─────────────────────────────────────────────────────────────────────────────

export type PropertyActionResult = { ok: true; message: string } | { ok: false; error: string };

const GONE = 'That property no longer exists. Refresh the page.';
const ACTION_FAILED = "That didn't work. Try again in a moment.";

/** Takes the listing off the site but keeps it in the main list, marked Archived. */
export async function archiveProperty(id: unknown): Promise<PropertyActionResult> {
  return changeStatus(id, 'ARCHIVED');
}

/** Archived → draft, so it can be edited and published again from the form. */
export async function unarchiveProperty(id: unknown): Promise<PropertyActionResult> {
  return changeStatus(id, 'DRAFT');
}

async function changeStatus(id: unknown, to: 'ARCHIVED' | 'DRAFT'): Promise<PropertyActionResult> {
  const admin = await assertAdmin();
  const propertyId = uuid().safeParse(id);
  if (!propertyId.success) return { ok: false, error: GONE };

  try {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId.data, deletedAt: null },
      select: { status: true, name: true },
    });
    if (!existing) return { ok: false, error: GONE };
    if (existing.status === to) return { ok: true, message: to === 'ARCHIVED' ? 'Already archived.' : 'Already a draft.' };
    if (to === 'DRAFT' && existing.status !== 'ARCHIVED') return { ok: false, error: 'Only archived properties can be unarchived.' };

    await prisma.$transaction([
      prisma.property.update({ where: { id: propertyId.data }, data: { status: to, updatedById: admin.id } }),
      prisma.auditLog.create({
        data: {
          action: existing.status === 'PUBLISHED' ? 'UNPUBLISH' : 'STATUS_CHANGE',
          entityType: 'Property',
          entityId: propertyId.data,
          changes: { status: { from: existing.status, to } },
          actorId: admin.id,
        },
      }),
    ]);
    revalidateListings(existing.status === 'PUBLISHED');
    return { ok: true, message: to === 'ARCHIVED' ? `Archived “${existing.name}”.` : `“${existing.name}” is a draft again.` };
  } catch (error) {
    console.error('changeStatus failed:', error);
    return { ok: false, error: ACTION_FAILED };
  }
}

/**
 * Moves a property to Deleted: gone from the site and the main list, but its
 * photos, documents and enquiry links are kept, so it can be restored.
 */
export async function deleteProperty(id: unknown): Promise<PropertyActionResult> {
  const admin = await assertAdmin();
  const propertyId = uuid().safeParse(id);
  if (!propertyId.success) return { ok: false, error: GONE };

  try {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId.data, deletedAt: null },
      select: { status: true, name: true },
    });
    if (!existing) return { ok: false, error: GONE };

    await prisma.$transaction([
      prisma.property.update({
        where: { id: propertyId.data },
        data: { deletedAt: new Date(), isFeatured: false, updatedById: admin.id },
      }),
      prisma.auditLog.create({
        data: { action: 'DELETE', entityType: 'Property', entityId: propertyId.data, changes: { name: existing.name }, actorId: admin.id },
      }),
    ]);
    revalidateListings(existing.status === 'PUBLISHED');
    return { ok: true, message: `Deleted “${existing.name}”. You can restore it from Deleted.` };
  } catch (error) {
    console.error('deleteProperty failed:', error);
    return { ok: false, error: ACTION_FAILED };
  }
}

/** Brings a deleted property back. A listing that was live comes back as a draft, so nothing reappears on the site unchecked. */
export async function restoreProperty(id: unknown): Promise<PropertyActionResult> {
  const admin = await assertAdmin();
  const propertyId = uuid().safeParse(id);
  if (!propertyId.success) return { ok: false, error: GONE };

  try {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId.data, deletedAt: { not: null } },
      select: { status: true, name: true },
    });
    if (!existing) return { ok: false, error: GONE };
    const status = existing.status === 'PUBLISHED' ? 'DRAFT' : existing.status;

    await prisma.$transaction([
      prisma.property.update({ where: { id: propertyId.data }, data: { deletedAt: null, status, updatedById: admin.id } }),
      prisma.auditLog.create({
        data: {
          action: 'RESTORE',
          entityType: 'Property',
          entityId: propertyId.data,
          changes: { name: existing.name, ...(status !== existing.status ? { status: { from: existing.status, to: status } } : {}) },
          actorId: admin.id,
        },
      }),
    ]);
    revalidateListings(false);
    return {
      ok: true,
      message: existing.status === 'PUBLISHED' ? `Restored “${existing.name}” as a draft. Publish it when it’s ready.` : `Restored “${existing.name}”.`,
    };
  } catch (error) {
    console.error('restoreProperty failed:', error);
    return { ok: false, error: ACTION_FAILED };
  }
}

/**
 * Permanently removes a property that is already in Deleted, with its photos,
 * documents and amenity ticks. Enquiries about it are kept (unlinked). The
 * stored files are removed from the buckets after the response.
 */
export async function deletePropertyForever(id: unknown): Promise<PropertyActionResult> {
  const admin = await assertAdmin();
  const propertyId = uuid().safeParse(id);
  if (!propertyId.success) return { ok: false, error: GONE };

  try {
    const existing = await prisma.property.findFirst({
      where: { id: propertyId.data, deletedAt: { not: null } },
      select: {
        name: true,
        refNumber: true,
        media: { select: { storageKey: true } },
        documents: { select: { storageKey: true } },
      },
    });
    if (!existing) return { ok: false, error: 'Only properties in Deleted can be removed for good.' };

    await prisma.$transaction([
      prisma.property.delete({ where: { id: propertyId.data } }),
      prisma.auditLog.create({
        data: {
          action: 'DELETE',
          entityType: 'Property',
          entityId: propertyId.data,
          changes: { name: existing.name, refNumber: existing.refNumber, permanent: true },
          actorId: admin.id,
        },
      }),
    ]);

    const mediaKeys = existing.media.map(m => m.storageKey).filter((k): k is string => !!k && !k.startsWith('seed/'));
    const documentKeys = existing.documents.map(d => d.storageKey);
    after(() => removeStoredFiles(mediaKeys, documentKeys));

    revalidateListings(false);
    return { ok: true, message: `“${existing.name}” was removed for good.` };
  } catch (error) {
    console.error('deletePropertyForever failed:', error);
    return { ok: false, error: ACTION_FAILED };
  }
}
