import { attachPropertyDocuments, requestDocumentUploads } from "@/actions/document.action";
import { attachPropertyPhotos, requestPhotoUploads } from "@/actions/media.action";
import type { DocumentType } from "@/lib/generated/prisma/enums";

/** A photo picked in the form but not uploaded yet. */
export type StagedPhoto = {
  kind: "new";
  /** Client-side id, only for React keys and matching up after upload. */
  id: string;
  file: File;
  /** blob: URL for the thumbnail. Revoke it when the photo is removed. */
  previewUrl: string;
  altText: string;
  width?: number;
  height?: number;
};

/** A photo already stored for the property. */
export type SavedPhoto = {
  kind: "saved";
  /** Database id. */
  id: string;
  url: string;
  altText: string;
};

export type PhotoItem = StagedPhoto | SavedPhoto;

/** A document picked in the form but not uploaded yet. */
export type StagedDocument = {
  kind: "new";
  id: string;
  file: File;
  name: string;
  type: DocumentType;
  /** Buyers can open it from the listing (still through a short-lived link). */
  isPublic: boolean;
};

/** A document already stored for the property. */
export type SavedDocument = {
  kind: "saved";
  id: string;
  name: string;
  type: DocumentType;
  isPublic: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type DocumentItem = StagedDocument | SavedDocument;

type UploadResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Uploads staged photos for a saved property:
 *   1. ask the server for signed URLs (it validates type, size and count),
 *   2. PUT each file straight to R2, reporting progress,
 *   3. tell the server to check the files and record them, in this order.
 * Returns the saved version of each photo, keyed by its client id, so the form
 * can swap them in and never upload them twice.
 */
export async function uploadPropertyPhotos(
  propertyId: string,
  photos: StagedPhoto[],
  onProgress?: (fraction: number) => void,
): Promise<UploadResult<Map<string, SavedPhoto>>> {
  if (photos.length === 0) return { ok: true, data: new Map() };

  const signed = await requestPhotoUploads({
    propertyId,
    files: photos.map((p) => ({ fileName: p.file.name, contentType: p.file.type, sizeBytes: p.file.size })),
  });
  if (!signed.ok) return signed;

  const sent = await putAll(signed.data, photos.map((p) => p.file), onProgress);
  if (!sent.ok) return sent;

  const attached = await attachPropertyPhotos({
    propertyId,
    photos: photos.map((p, i) => ({ storageKey: signed.data[i].key, altText: p.altText, width: p.width, height: p.height })),
  });
  if (!attached.ok) return attached;

  const byKey = new Map(attached.data.photos.map((m) => [m.storageKey, m]));
  const saved = new Map<string, SavedPhoto>();
  photos.forEach((p, i) => {
    const row = byKey.get(signed.data[i].key);
    if (row) saved.set(p.id, { kind: "saved", id: row.id, url: row.url, altText: p.altText });
  });
  return { ok: true, data: saved };
}

/** Same three steps for documents, which go to the private bucket. */
export async function uploadPropertyDocuments(
  propertyId: string,
  documents: StagedDocument[],
  onProgress?: (fraction: number) => void,
): Promise<UploadResult<Map<string, SavedDocument>>> {
  if (documents.length === 0) return { ok: true, data: new Map() };

  const signed = await requestDocumentUploads({
    propertyId,
    files: documents.map((d) => ({ fileName: d.file.name, contentType: d.file.type, sizeBytes: d.file.size })),
  });
  if (!signed.ok) return signed;

  const sent = await putAll(signed.data, documents.map((d) => d.file), onProgress);
  if (!sent.ok) return sent;

  const attached = await attachPropertyDocuments({
    propertyId,
    documents: documents.map((d, i) => ({ storageKey: signed.data[i].key, type: d.type, name: d.name, isPublic: d.isPublic })),
  });
  if (!attached.ok) return attached;

  const byKey = new Map(attached.data.documents.map((d) => [d.storageKey, d]));
  const saved = new Map<string, SavedDocument>();
  documents.forEach((d, i) => {
    const row = byKey.get(signed.data[i].key);
    if (row) {
      saved.set(d.id, {
        kind: "saved",
        id: row.id,
        name: d.name,
        type: d.type,
        isPublic: d.isPublic,
        mimeType: d.file.type,
        sizeBytes: d.file.size,
      });
    }
  });
  return { ok: true, data: saved };
}

const CONCURRENT_UPLOADS = 3;

/** PUTs files to their signed URLs, three at a time, with combined progress. */
async function putAll(
  targets: { uploadUrl: string }[],
  files: File[],
  onProgress?: (fraction: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const loaded = new Array<number>(files.length).fill(0);
  const report = () => onProgress?.(loaded.reduce((a, b) => a + b, 0) / total);

  try {
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        await putFile(targets[i].uploadUrl, files[i], (bytes) => {
          loaded[i] = bytes;
          report();
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENT_UPLOADS, files.length) }, worker));
    return { ok: true };
  } catch {
    return { ok: false, error: "Some files didn't upload. Check your connection and try again." };
  }
}

/** fetch() can't report upload progress, so use XHR for the PUT. */
function putFile(url: string, file: File, onBytes: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type); // must match the signed type
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onBytes(file.size);
        resolve();
      } else reject(new Error(`Upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
