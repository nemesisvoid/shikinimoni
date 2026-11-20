import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * An agent's proposed edits to a live listing (Property.pendingChanges). The live
 * listing doesn't change until an admin approves; new photos and documents are
 * stored straight away but flagged `pendingReview`, so the site never shows them.
 */
export type PendingChanges = {
  /** The property form's values, as sent (validated again when approved). */
  values?: Record<string, unknown>;
  /** The full photo list in order (first = cover), including pending uploads. */
  photos?: { id: string; altText?: string | null }[];
  /** The full document list, including pending uploads. */
  documents?: { id: string; name: string; type: string; isPublic: boolean }[];
};

export function readPendingChanges(raw: unknown): PendingChanges | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PendingChanges;
}

/** Merges one part of the proposed edits into what's stored, in one statement. */
export async function mergePendingChanges(propertyId: string, patch: PendingChanges) {
  await prisma.$executeRaw`
    UPDATE "properties"
    SET "pendingChanges" = COALESCE("pendingChanges", '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    WHERE "id" = ${propertyId}::uuid`;
}

export const asJson = (value: PendingChanges) => value as Prisma.InputJsonValue;

/** Removes pending changes and pending uploads. Returns the storage keys to delete afterwards. */
export async function clearPendingChanges(propertyId: string) {
  const [media, documents] = await Promise.all([
    prisma.propertyMedia.findMany({ where: { propertyId, pendingReview: true }, select: { storageKey: true } }),
    prisma.propertyDocument.findMany({ where: { propertyId, pendingReview: true }, select: { storageKey: true } }),
  ]);
  await prisma.$transaction([
    prisma.propertyMedia.deleteMany({ where: { propertyId, pendingReview: true } }),
    prisma.propertyDocument.deleteMany({ where: { propertyId, pendingReview: true } }),
    prisma.property.update({ where: { id: propertyId }, data: { pendingChanges: Prisma.DbNull, submittedAt: null, reviewNote: null } }),
  ]);
  return {
    media: media.map(m => m.storageKey).filter((k): k is string => !!k && !k.startsWith("seed/")),
    documents: documents.map(d => d.storageKey),
  };
}

