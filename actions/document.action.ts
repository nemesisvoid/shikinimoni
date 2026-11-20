'use server';

import { revalidatePath, updateTag } from 'next/cache';
import * as z from 'zod';
import { checkEditAccess, currentUserIsAdmin, getCurrentUser } from '@/lib/auth/guards';
import { mergePendingChanges } from '@/lib/listings/pending';
import { prisma } from '@/lib/db';
import { LISTINGS_TAG } from '@/lib/listings/tags';
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
  const parsed = RequestDocumentUploadsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, files } = parsed.data;
  // Admins, or the listing's own agent. Throws for anyone else.
  const access = await checkEditAccess(propertyId);
  if (!access.ok) return { ok: false, error: access.error };

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };

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
  const parsed = AttachDocumentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, documents } = parsed.data;
  const access = await checkEditAccess(propertyId);
  if (!access.ok) return { ok: false, error: access.error };
  // An agent adding documents to a live listing: stored, but hidden until approved.
  const pending = access.mode === 'pending';

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };

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
      pendingReview: pending,
      uploadedById: access.user.id,
    })),
  });
  revalidateFor(pending);
  return { ok: true, data: { documents: created } };
}

/**
 * Edit form: saves each kept document's name, type and visibility, and deletes
 * removed documents from the database and the private bucket.
 */
export async function arrangePropertyDocuments(input: unknown): Promise<Result<null>> {
  const parsed = ArrangeDocumentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { propertyId, documents, removedIds } = parsed.data;
  const access = await checkEditAccess(propertyId);
  if (!access.ok) return { ok: false, error: access.error };
  const keepIds = documents.map((d) => d.id);
  if (removedIds.some((id) => keepIds.includes(id))) {
    return { ok: false, error: 'A document is marked both kept and removed.' };
  }

  const owned = await prisma.propertyDocument.findMany({
    where: { propertyId, id: { in: [...keepIds, ...removedIds] } },
    select: { id: true, storageKey: true, pendingReview: true },
  });
  if (owned.length !== keepIds.length + removedIds.length) {
    return { ok: false, error: 'Some documents changed since this page loaded. Refresh the page and try again.' };
  }

  if (access.mode === 'pending') {
    // A live listing: remember the agent's list for review. Only their own
    // pending uploads are deleted now; live documents stay until approval.
    const dropped = owned.filter((d) => removedIds.includes(d.id) && d.pendingReview);
    if (dropped.length > 0) {
      await prisma.propertyDocument.deleteMany({ where: { id: { in: dropped.map((d) => d.id) } } });
      if (isStorageConfigured('documents')) {
        await deleteObjects('documents', dropped.map((d) => d.storageKey)).catch((error) => console.error('Document cleanup failed:', error));
      }
    }
    await mergePendingChanges(propertyId, {
      documents: documents.map((d) => ({ id: d.id, name: d.name, type: d.type, isPublic: d.isPublic })),
    });
    revalidateFor(true);
    return { ok: true, data: null };
  }

  await prisma.$transaction([
    prisma.propertyDocument.deleteMany({ where: { propertyId, id: { in: removedIds } } }),
    ...documents.map((doc) =>
      prisma.propertyDocument.update({
        where: { id: doc.id },
        data: { name: doc.name, type: doc.type, isPublic: doc.isPublic, pendingReview: false },
      }),
    ),
  ]);

  const removedKeys = owned.filter((d) => removedIds.includes(d.id)).map((d) => d.storageKey);
  if (removedKeys.length > 0 && isStorageConfigured('documents')) {
    await deleteObjects('documents', removedKeys).catch((error) => console.error('Document cleanup failed:', error));
  }

  revalidateFor(false);
  return { ok: true, data: null };
}

/** Pending uploads only show in the agent area and the review queue; anything else can show on the site. */
function revalidateFor(pending: boolean) {
  revalidatePath('/admin', 'layout');
  revalidatePath('/agent', 'layout');
  if (!pending) updateTag(LISTINGS_TAG); // shared documents show on the public property page
}

/**
 * A 5-minute link to open one document. Admins can open any document, an agent
 * the documents on their own listings, and everyone else only documents marked
 * "show to buyers" on a published, live listing (never one still pending review).
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
      pendingReview: true,
      property: { select: { status: true, deletedAt: true, agentId: true } },
    },
  });
  // Same answer for "missing" and "not allowed", so private documents can't be probed.
  if (!doc) return { ok: false, error: 'Document not found.' };

  const visibleToPublic = doc.isPublic && !doc.pendingReview && doc.property.status === 'PUBLISHED' && doc.property.deletedAt === null;
  if (!visibleToPublic && !(await currentUserIsAdmin())) {
    const user = doc.property.agentId ? await getCurrentUser() : null;
    if (!user || user.id !== doc.property.agentId) return { ok: false, error: 'Document not found.' };
  }

  if (!isStorageConfigured('documents')) return { ok: false, error: NOT_CONFIGURED };
  const extension = doc.mimeType === 'application/pdf' ? '.pdf' : doc.mimeType === 'image/png' ? '.png' : '.jpg';
  const url = await createDownloadUrl('documents', doc.storageKey, { fileName: `${doc.name}${extension}` });
  return { ok: true, data: { url } };
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Some of the document details are invalid.';
}
