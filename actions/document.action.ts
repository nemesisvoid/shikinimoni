'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { assertAdmin, getCurrentUser, isAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObjects,
  getObjectInfo,
  isStorageConfigured,
  propertyObjectKey,
} from '@/lib/storage/r2';
import {
  ArrangeDocumentsSchema,
  AttachDocumentsSchema,
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_PROPERTY,
  MediaIdSchema,
  RequestDocumentUploadsSchema,
} from '@/schemas/media.schema';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const NOT_CONFIGURED = "Document storage isn't set up yet, so documents can't be uploaded.";

/**
 * Step 1: validate the files and hand back one signed upload URL per document.
 * Documents go to the PRIVATE bucket; nothing there has a public URL.
 */
export async function requestDocumentUploads(input: unknown): Promise<Result<{ key: string; uploadUrl: string }[]>> {
  await assertAdmin();

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };

  const parsed = RequestDocumentUploadsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, files } = parsed.data;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
    select: { _count: { select: { documents: true } } },
  });
  if (!property) return { ok: false, error: 'That property no longer exists.' };
  if (property._count.documents + files.length > MAX_DOCUMENTS_PER_PROPERTY) {
    const left = MAX_DOCUMENTS_PER_PROPERTY - property._count.documents;
    return { ok: false, error: `This property can take ${left} more document${left === 1 ? '' : 's'}.` };
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const key = propertyObjectKey(propertyId, file.contentType);
      return {
        key,
        uploadUrl: await createUploadUrl('documents', { key, contentType: file.contentType, sizeBytes: file.sizeBytes }),
      };
    }),
  );
  return { ok: true, data: uploads };
}

/** Step 2: check each uploaded object, then record the documents. */
export async function attachPropertyDocuments(
  input: unknown,
): Promise<Result<{ documents: { id: string; storageKey: string }[] }>> {
  const admin = await assertAdmin();

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };

  const parsed = AttachDocumentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, documents } = parsed.data;

  const prefix = `properties/${propertyId}/`;
  if (documents.some((d) => !d.storageKey.startsWith(prefix) || d.storageKey.includes('..'))) {
    return { ok: false, error: 'One of the documents belongs to a different property.' };
  }

  const infos = await Promise.all(documents.map((d) => getObjectInfo('documents', d.storageKey)));
  const badKeys = documents
    .filter((_, i) => {
      const info = infos[i];
      return (
        !info ||
        info.sizeBytes <= 0 ||
        info.sizeBytes > MAX_DOCUMENT_BYTES ||
        !(DOCUMENT_MIME_TYPES as readonly string[]).includes(info.contentType)
      );
    })
    .map((d) => d.storageKey);
  if (badKeys.length > 0) {
    // Nothing from this batch is recorded and a retry re-uploads all of it, so
    // remove the whole batch rather than leave unreferenced files behind.
    await deleteObjects('documents', documents.map((d) => d.storageKey));
    return {
      ok: false,
      error: `${badKeys.length} document${badKeys.length === 1 ? " didn't" : "s didn't"} upload correctly. Try again.`,
    };
  }

  const exists = await prisma.property.count({ where: { id: propertyId, deletedAt: null } });
  if (!exists) {
    await deleteObjects('documents', documents.map((d) => d.storageKey));
    return { ok: false, error: 'That property no longer exists.' };
  }

  const created = await prisma.propertyDocument.createManyAndReturn({
    select: { id: true, storageKey: true },
    data: documents.map((doc, i) => ({
      propertyId,
      type: doc.type,
      name: doc.name,
      storageKey: doc.storageKey,
      mimeType: infos[i]!.contentType,
      sizeBytes: infos[i]!.sizeBytes,
      isPublic: doc.isPublic,
      uploadedById: admin.id,
    })),
  });
  revalidatePath('/admin', 'layout');
  return { ok: true, data: { documents: created } };
}

/**
 * Edit form: saves each kept document's name, type and visibility, and deletes
 * removed documents from the database and the private bucket.
 */
export async function arrangePropertyDocuments(input: unknown): Promise<Result<null>> {
  await assertAdmin();

  const parsed = ArrangeDocumentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, documents, removedIds } = parsed.data;
  const keepIds = documents.map((d) => d.id);
  if (removedIds.some((id) => keepIds.includes(id))) {
    return { ok: false, error: 'A document is marked both kept and removed.' };
  }

  const owned = await prisma.propertyDocument.findMany({
    where: { propertyId, id: { in: [...keepIds, ...removedIds] } },
    select: { id: true, storageKey: true },
  });
  if (owned.length !== keepIds.length + removedIds.length) {
    return { ok: false, error: 'Some documents changed since this page loaded. Refresh the page and try again.' };
  }

  await prisma.$transaction([
    prisma.propertyDocument.deleteMany({ where: { propertyId, id: { in: removedIds } } }),
    ...documents.map((doc) =>
      prisma.propertyDocument.update({
        where: { id: doc.id },
        data: { name: doc.name, type: doc.type, isPublic: doc.isPublic },
      }),
    ),
  ]);

  const removedKeys = owned.filter((d) => removedIds.includes(d.id)).map((d) => d.storageKey);
  if (removedKeys.length > 0 && isStorageConfigured('documents')) {
    await deleteObjects('documents', removedKeys).catch((error) => console.error('Document cleanup failed:', error));
  }

  revalidatePath('/admin', 'layout');
  return { ok: true, data: null };
}

/**
 * A 5-minute link to open one document. Admins can open any document; everyone
 * else only documents marked "show to buyers" on a published, live listing.
 */
export async function getDocumentLink(input: unknown): Promise<Result<{ url: string }>> {
  const parsed = MediaIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Document not found.' };

  const doc = await prisma.propertyDocument.findUnique({
    where: { id: parsed.data.id },
    select: {
      name: true,
      storageKey: true,
      mimeType: true,
      isPublic: true,
      property: { select: { status: true, deletedAt: true } },
    },
  });
  // Same answer for "missing" and "not allowed", so private documents can't be probed.
  if (!doc) return { ok: false, error: 'Document not found.' };

  const visibleToPublic = doc.isPublic && doc.property.status === 'PUBLISHED' && doc.property.deletedAt === null;
  if (!visibleToPublic && !isAdmin(await getCurrentUser())) return { ok: false, error: 'Document not found.' };

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };
  const extension = doc.mimeType === 'application/pdf' ? '.pdf' : doc.mimeType === 'image/png' ? '.png' : '.jpg';
  const url = await createDownloadUrl('documents', doc.storageKey, { fileName: `${doc.name}${extension}` });
  return { ok: true, data: { url } };
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Some of the document details are invalid.';
}
