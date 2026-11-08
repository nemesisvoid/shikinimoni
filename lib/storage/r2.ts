import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 through its S3-compatible API.
 *
 * Uploads go straight from the browser to R2 with a short-lived signed URL, so
 * files never pass through our server (or its request-size limits). The server
 * only signs URLs, checks the uploaded object, and records it in the database.
 *
 * Two buckets:
 *   media      PUBLIC. Listing photos, served at R2_PUBLIC_URL through next/image.
 *   documents  PRIVATE (public access off). Title documents, survey plans, deeds.
 *              Never linked directly: viewers get a signed URL that expires in minutes.
 *
 * Env (see .env.local):
 *   R2_ACCOUNT_ID         Cloudflare account id
 *   R2_ACCESS_KEY_ID      R2 API token: Access Key ID (needs both buckets)
 *   R2_SECRET_ACCESS_KEY  R2 API token: Secret Access Key
 *   R2_BUCKET             media bucket, e.g. shikinimoni-media
 *   R2_PUBLIC_URL         public base URL of the media bucket, no trailing slash
 *                         (r2.dev URL for dev, custom domain for production)
 *   R2_DOCUMENTS_BUCKET   private documents bucket, e.g. shikinimoni-documents
 *   R2_ENDPOINT           optional; only for jurisdiction buckets (e.g. EU:
 *                         https://<account>.eu.r2.cloudflarestorage.com). Location
 *                         hints such as "Western Europe" use the default endpoint.
 */

export type BucketKind = "media" | "documents";

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

type R2Credentials = { accountId: string; accessKeyId: string; secretAccessKey: string };

function readCredentials(): R2Credentials | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey };
}

function bucketName(kind: BucketKind) {
  return (kind === "media" ? process.env.R2_BUCKET : process.env.R2_DOCUMENTS_BUCKET) || null;
}

function mediaPublicUrl() {
  return process.env.R2_PUBLIC_URL?.replace(/\/+$/, "") || null;
}

export class StorageNotConfiguredError extends Error {
  constructor(kind: BucketKind) {
    super(
      kind === "media"
        ? "Photo storage isn't set up. Add the R2_* variables to .env.local and restart the server."
        : "Document storage isn't set up. Add R2_DOCUMENTS_BUCKET to .env.local and restart the server.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

export function isStorageConfigured(kind: BucketKind = "media") {
  if (!readCredentials() || !bucketName(kind)) return false;
  return kind === "documents" || mediaPublicUrl() !== null;
}

let cachedClient: S3Client | undefined;

function client() {
  if (cachedClient) return cachedClient;
  const creds = readCredentials();
  if (!creds) throw new StorageNotConfiguredError("media");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT?.replace(/\/+$/, "") || `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
    // Newer SDKs add CRC32 checksum headers to every PUT. A browser uploading
    // through a signed URL can't compute them, so only send them when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

function bucket(kind: BucketKind) {
  const name = bucketName(kind);
  if (!name) throw new StorageNotConfiguredError(kind);
  return name;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

/**
 * properties/<propertyId>/<random>.<ext>. Random names: never trust or expose
 * the uploader's file name (the original name is kept in the database instead).
 */
export function propertyObjectKey(propertyId: string, contentType: string) {
  return `properties/${propertyId}/${randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
}

/** Public URL of a photo. Only the media bucket has one. */
export function publicUrlFor(key: string) {
  const base = mediaPublicUrl();
  if (!base) throw new StorageNotConfiguredError("media");
  return `${base}/${key}`;
}

/**
 * Signed PUT URL for one object. Content-Type and Content-Length are part of
 * the signature, so the browser must upload exactly the type and size that was
 * validated; anything else is rejected by R2 with 403.
 */
export async function createUploadUrl(
  kind: BucketKind,
  { key, contentType, sizeBytes }: { key: string; contentType: string; sizeBytes: number },
) {
  const command = new PutObjectCommand({
    Bucket: bucket(kind),
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    CacheControl: kind === "media" ? "public, max-age=31536000, immutable" : "private, no-store",
  });
  return getSignedUrl(client(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/**
 * Short-lived link to view or download a private document. Check the viewer is
 * allowed to see it BEFORE calling this; anyone holding the link can open it
 * until it expires.
 */
export async function createDownloadUrl(
  kind: BucketKind,
  key: string,
  { fileName, inline = true }: { fileName?: string; inline?: boolean } = {},
) {
  const disposition = fileName
    ? `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`
    : undefined;
  const command = new GetObjectCommand({ Bucket: bucket(kind), Key: key, ResponseContentDisposition: disposition });
  return getSignedUrl(client(), command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/** Size and type of an uploaded object, or null if it isn't there. */
export async function getObjectInfo(kind: BucketKind, key: string) {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: bucket(kind), Key: key }));
    return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound") return null;
    throw error;
  }
}

export async function deleteObjects(kind: BucketKind, keys: string[]) {
  if (keys.length === 0) return;
  await client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(kind),
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
