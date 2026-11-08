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

export type RequestImageUploadInput = z.output<typeof RequestImageUploadSchema>;
export type RequestDocumentUploadInput = z.output<typeof RequestDocumentUploadSchema>;
export type CreatePropertyMediaInput = z.output<typeof CreatePropertyMediaSchema>;
export type ReorderPropertyMediaInput = z.output<typeof ReorderPropertyMediaSchema>;
