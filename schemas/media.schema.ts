import * as z from 'zod';
import { DocumentType, MediaType } from '@/lib/generated/prisma/enums';
import { checkbox, optionalCount, optionalText, requiredEnum, requiredText, uuid } from './fields';

// Upload limits, shared by the form (accept=, client checks) and the server.
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_MEDIA_PER_PROPERTY = 40;

const fileSize = (max: number, label: string) =>
  z.coerce
    .number({ error: 'Invalid file size' })
    .int({ error: 'Invalid file size' })
    .positive({ error: 'The file is empty' })
    .max(max, { error: `${label} must be ${max / 1024 / 1024} MB or smaller` });

/**
 * Step 1 of an upload: the browser asks for a signed upload URL. Validate here,
 * before any storage URL is issued, so oversized or wrong-type files never upload.
 */
export const RequestImageUploadSchema = z.object({
  propertyId: uuid('property id'),
  fileName: requiredText('a file name', { max: 255 }),
  contentType: z.enum(IMAGE_MIME_TYPES, { error: 'Upload a JPEG, PNG, WebP or AVIF image' }),
  sizeBytes: fileSize(MAX_IMAGE_BYTES, 'Images'),
});

export const RequestDocumentUploadSchema = z.object({
  propertyId: uuid('property id'),
  type: requiredEnum(DocumentType, 'a document type'),
  name: requiredText('a document name', { max: 200 }),
  contentType: z.enum(DOCUMENT_MIME_TYPES, { error: 'Upload a PDF, JPEG or PNG file' }),
  sizeBytes: fileSize(MAX_DOCUMENT_BYTES, 'Documents'),
  isPublic: checkbox().default(false),
});

/**
 * Step 2: after the browser finishes uploading, save the record. Photos and
 * floor plans must come from your storage (storageKey); videos and virtual tours
 * may be external links (YouTube, Matterport) with no storageKey.
 */
export const CreatePropertyMediaSchema = z
  .object({
    propertyId: uuid('property id'),
    type: requiredEnum(MediaType, 'a media type').default('IMAGE'),
    url: z.url({ protocol: /^https$/, error: 'Enter a valid https link' }),
    storageKey: optionalText(512),
    altText: optionalText(200),
    caption: optionalText(300),
    mimeType: optionalText(100),
    sizeBytes: optionalCount(2_147_483_647),
    width: optionalCount(20_000),
    height: optionalCount(20_000),
    isCover: checkbox().default(false),
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'IMAGE' || data.type === 'FLOOR_PLAN') && !data.storageKey) {
      ctx.addIssue({ code: 'custom', path: ['storageKey'], message: 'Upload the file first' });
    }
  });

/** Edit the caption/alt text of one photo. */
export const UpdatePropertyMediaSchema = z
  .object({
    id: uuid('media id'),
    altText: optionalText(200),
    caption: optionalText(300),
  })
  .refine((d) => d.altText !== undefined || d.caption !== undefined, { error: 'There are no changes to save' });

/** Drag-to-reorder: the full list of the property's media ids in their new order. */
export const ReorderPropertyMediaSchema = z.object({
  propertyId: uuid('property id'),
  mediaIds: z
    .array(uuid('media id'))
    .min(1, { error: 'Nothing to reorder' })
    .max(MAX_MEDIA_PER_PROPERTY, { error: `A property can have ${MAX_MEDIA_PER_PROPERTY} media items at most` })
    .refine((ids) => new Set(ids).size === ids.length, { error: 'Each item can appear only once' }),
});

export const SetCoverImageSchema = z.object({
  propertyId: uuid('property id'),
  mediaId: uuid('media id'),
});

export const MediaIdSchema = z.object({ id: uuid('media id') });

// ─────────────────────────────────────────────────────────────────────────────
// Photo batches (the property form uploads several photos at once)
// ─────────────────────────────────────────────────────────────────────────────

const photoFile = RequestImageUploadSchema.omit({ propertyId: true });

/** Step 1 for a batch: one signed upload URL per photo. */
export const RequestPhotoUploadsSchema = z.object({
  propertyId: uuid('property id'),
  files: z
    .array(photoFile, { error: 'Choose at least one photo' })
    .min(1, { error: 'Choose at least one photo' })
    .max(MAX_MEDIA_PER_PROPERTY, { error: `Upload ${MAX_MEDIA_PER_PROPERTY} photos or fewer` }),
});

/**
 * Step 2 for a batch: record the uploaded photos, in display order. The URL is
 * built on the server from the key, never taken from the browser.
 */
export const AttachPhotosSchema = z.object({
  propertyId: uuid('property id'),
  photos: z
    .array(
      z.object({
        storageKey: z.string().min(1).max(512),
        altText: optionalText(200),
        caption: optionalText(300),
        width: optionalCount(20_000),
        height: optionalCount(20_000),
      }),
    )
    .min(1, { error: 'There are no photos to save' })
    .max(MAX_MEDIA_PER_PROPERTY, { error: `Upload ${MAX_MEDIA_PER_PROPERTY} photos or fewer` }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Document batches (title documents, survey plans…). Stored in the PRIVATE bucket.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DOCUMENTS_PER_PROPERTY = 20;

const documentFile = RequestDocumentUploadSchema.pick({ contentType: true, sizeBytes: true }).extend({
  fileName: requiredText('a file name', { max: 255 }),
});

/** Step 1 for a batch: one signed upload URL per document. */
export const RequestDocumentUploadsSchema = z.object({
  propertyId: uuid('property id'),
  files: z
    .array(documentFile, { error: 'Choose at least one document' })
    .min(1, { error: 'Choose at least one document' })
    .max(MAX_DOCUMENTS_PER_PROPERTY, { error: `Upload ${MAX_DOCUMENTS_PER_PROPERTY} documents or fewer` }),
});

/** Step 2 for a batch: record the uploaded documents with their details. */
export const AttachDocumentsSchema = z.object({
  propertyId: uuid('property id'),
  documents: z
    .array(
      z.object({
        storageKey: z.string().min(1).max(512),
        type: requiredEnum(DocumentType, 'a document type'),
        name: requiredText('a document name', { max: 200 }),
        isPublic: checkbox().default(false),
      }),
    )
    .min(1, { error: 'There are no documents to save' })
    .max(MAX_DOCUMENTS_PER_PROPERTY, { error: `Upload ${MAX_DOCUMENTS_PER_PROPERTY} documents or fewer` }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit form: the final state of the saved photos/documents, applied in one go
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every photo the property should keep, in display order (the first is the
 * cover), plus the ones to delete. New uploads are attached first, so their ids
 * are already in `photos`.
 */
export const ArrangePhotosSchema = z.object({
  propertyId: uuid('property id'),
  photos: z
    .array(z.object({ id: uuid('photo id'), altText: optionalText(200) }))
    .max(MAX_MEDIA_PER_PROPERTY, { error: `A property can have ${MAX_MEDIA_PER_PROPERTY} photos at most` })
    .refine((list) => new Set(list.map((p) => p.id)).size === list.length, { error: 'Each photo can appear only once' }),
  removedIds: z.array(uuid('photo id')).max(MAX_MEDIA_PER_PROPERTY),
});

/** Every document the property should keep, with its details, plus the ones to delete. */
export const ArrangeDocumentsSchema = z.object({
  propertyId: uuid('property id'),
  documents: z
    .array(
      z.object({
        id: uuid('document id'),
        type: requiredEnum(DocumentType, 'a document type'),
        name: requiredText('a document name', { max: 200 }),
        isPublic: checkbox().default(false),
      }),
    )
    .max(MAX_DOCUMENTS_PER_PROPERTY, { error: `A property can have ${MAX_DOCUMENTS_PER_PROPERTY} documents at most` }),
  removedIds: z.array(uuid('document id')).max(MAX_DOCUMENTS_PER_PROPERTY),
});

export type PhotoFileInput = z.input<typeof photoFile>;
export type AttachPhotosInput = z.input<typeof AttachPhotosSchema>;

export type RequestImageUploadInput = z.output<typeof RequestImageUploadSchema>;
export type RequestDocumentUploadInput = z.output<typeof RequestDocumentUploadSchema>;
export type CreatePropertyMediaInput = z.output<typeof CreatePropertyMediaSchema>;
export type ReorderPropertyMediaInput = z.output<typeof ReorderPropertyMediaSchema>;
