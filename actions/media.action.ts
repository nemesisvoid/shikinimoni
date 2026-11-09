'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  createUploadUrl,
  deleteObjects,
  getObjectInfo,
  isStorageConfigured,
  propertyObjectKey,
  publicUrlFor,
} from '@/lib/storage/r2';
import {
  ArrangePhotosSchema,
  AttachPhotosSchema,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_PER_PROPERTY,
  RequestPhotoUploadsSchema,
} from '@/schemas/media.schema';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const NOT_CONFIGURED = "Photo storage isn't set up yet, so photos can't be uploaded.";

/**
 * Step 1: validate the files and hand back one signed upload URL per photo.
 * The browser then PUTs each file straight to R2.
 */
export async function requestPhotoUploads(input: unknown): Promise<Result<{ key: string; uploadUrl: string }[]>> {
  await assertAdmin(); // throws for signed-out / non-admin callers

  if (!isStorageConfigured('media')) return { ok: false, error: NOT_CONFIGURED };

  const parsed = RequestPhotoUploadsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, files } = parsed.data;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
    select: { _count: { select: { media: true } } },
  });
  if (!property) return { ok: false, error: 'That property no longer exists.' };
  if (property._count.media + files.length > MAX_MEDIA_PER_PROPERTY) {
    const left = MAX_MEDIA_PER_PROPERTY - property._count.media;
    return { ok: false, error: `This property can take ${left} more photo${left === 1 ? '' : 's'}.` };
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const key = propertyObjectKey(propertyId, file.contentType);
      return { key, uploadUrl: await createUploadUrl('media', { key, contentType: file.contentType, sizeBytes: file.sizeBytes }) };
    }),
  );
  return { ok: true, data: uploads };
}

/**
 * Step 2: after the uploads finish, check each object really is in R2 with an
 * allowed type and size, then record them in display order. If the property
 * has no cover yet, the first photo becomes the cover.
 */
export async function attachPropertyPhotos(
  input: unknown,
): Promise<Result<{ photos: { id: string; storageKey: string; url: string }[] }>> {
  const admin = await assertAdmin();

  if (!isStorageConfigured('media')) return { ok: false, error: NOT_CONFIGURED };

  const parsed = AttachPhotosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, photos } = parsed.data;

  // Only keys issued for this property (step 1 puts them under its prefix).
  const prefix = `properties/${propertyId}/`;
  if (photos.some((p) => !p.storageKey.startsWith(prefix) || p.storageKey.includes('..'))) {
    return { ok: false, error: 'One of the photos belongs to a different property.' };
  }

  const infos = await Promise.all(photos.map((p) => getObjectInfo('media', p.storageKey)));
  const bad = photos.filter((_, i) => {
    const info = infos[i];
    return (
      !info ||
      info.sizeBytes <= 0 ||
      info.sizeBytes > MAX_IMAGE_BYTES ||
      !(IMAGE_MIME_TYPES as readonly string[]).includes(info.contentType)
    );
  });
  if (bad.length > 0) {
    // Nothing from this batch is recorded and a retry re-uploads all of it, so
    // remove the whole batch rather than leave unreferenced files behind.
    await deleteObjects('media', photos.map((p) => p.storageKey));
    return { ok: false, error: `${bad.length} photo${bad.length === 1 ? " didn't" : "s didn't"} upload correctly. Try again.` };
  }

  const created = await prisma.$transaction(async (tx) => {
    const property = await tx.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: {
        _count: { select: { media: true } },
        media: { where: { isCover: true }, select: { id: true }, take: 1 },
      },
    });
    if (!property) return null;

    const last = await tx.propertyMedia.aggregate({ where: { propertyId }, _max: { sortOrder: true } });
    const start = (last._max.sortOrder ?? -1) + 1;
    const needsCover = property.media.length === 0;

    return tx.propertyMedia.createManyAndReturn({
      select: { id: true, storageKey: true, url: true },
      data: photos.map((photo, i) => ({
        propertyId,
        type: 'IMAGE' as const,
        storageKey: photo.storageKey,
        url: publicUrlFor(photo.storageKey),
        altText: photo.altText ?? null,
        caption: photo.caption ?? null,
        mimeType: infos[i]!.contentType,
        sizeBytes: infos[i]!.sizeBytes,
        width: photo.width ?? null,
        height: photo.height ?? null,
        sortOrder: start + i,
        isCover: needsCover && i === 0,
        uploadedById: admin.id,
      })),
    });
  });

  if (created === null) {
    await deleteObjects('media', photos.map((p) => p.storageKey));
    return { ok: false, error: 'That property no longer exists.' };
  }
  revalidatePath('/admin', 'layout');
  return {
    ok: true,
    data: { photos: created.map((m) => ({ id: m.id, storageKey: m.storageKey!, url: m.url })) },
  };
}

/**
 * Edit form: applies the final photo list in one go. Sets display order (the
 * first photo is the cover), updates alt text, and deletes removed photos from
 * the database and from R2. Every id must belong to this property.
 */
export async function arrangePropertyPhotos(input: unknown): Promise<Result<null>> {
  await assertAdmin();

  const parsed = ArrangePhotosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, photos, removedIds } = parsed.data;
  const keepIds = photos.map((p) => p.id);
  if (removedIds.some((id) => keepIds.includes(id))) {
    return { ok: false, error: 'A photo is marked both kept and removed.' };
  }

  const owned = await prisma.propertyMedia.findMany({
    where: { propertyId, id: { in: [...keepIds, ...removedIds] } },
    select: { id: true, storageKey: true },
  });
  if (owned.length !== keepIds.length + removedIds.length) {
    return { ok: false, error: 'Some photos changed since this page loaded. Refresh the page and try again.' };
  }

  await prisma.$transaction([
    prisma.propertyMedia.deleteMany({ where: { propertyId, id: { in: removedIds } } }),
    // One cover at most: clear it everywhere first, then set it on the first photo.
    prisma.propertyMedia.updateMany({ where: { propertyId, isCover: true }, data: { isCover: false } }),
    ...photos.map((photo, i) =>
      prisma.propertyMedia.update({
        where: { id: photo.id },
        data: { sortOrder: i, isCover: i === 0, altText: photo.altText ?? null },
      }),
    ),
  ]);

  // Delete files only after the rows are gone, so a failed transaction never
  // leaves a row pointing at a missing file.
  const removedKeys = owned.filter((m) => removedIds.includes(m.id) && m.storageKey).map((m) => m.storageKey!);
  if (removedKeys.length > 0 && isStorageConfigured('media')) {
    await deleteObjects('media', removedKeys).catch((error) => console.error('Photo cleanup failed:', error));
  }

  revalidatePath('/admin', 'layout');
  return { ok: true, data: null };
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Some of the photo details are invalid.';
}
