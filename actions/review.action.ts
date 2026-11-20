'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { sendReviewOutcome, type ReviewOutcome } from '@/lib/email/agents';
import { Prisma } from '@/lib/generated/prisma/client';
import type { DocumentType } from '@/lib/generated/prisma/enums';
import { clearPendingChanges, readPendingChanges } from '@/lib/listings/pending';
import { checkInput, diff, freeSlug, removeStoredFiles, revalidateListings, slugTaken } from '@/lib/listings/property-write';
import { ReviewNoteSchema } from '@/schemas/agent.schema';
import { uuid } from '@/schemas/fields';

/**
 * Admin review of agent submissions: a new listing (status PENDING_REVIEW) or
 * changes to a live one (pendingChanges with submittedAt set). Each outcome is
 * logged and emailed to the agent.
 */

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

const GONE = 'That listing no longer exists. Refresh the page.';
const NOT_WAITING = 'This listing isn’t waiting for review any more. Refresh the page.';
const FAILED = "That didn't work. Try again in a moment.";

async function load(id: unknown) {
  const parsed = uuid().safeParse(id);
  if (!parsed.success) return null;
  return prisma.property.findFirst({
    where: { id: parsed.data, deletedAt: null },
    include: { amenities: { select: { amenityId: true } } },
  });
}

function finish(listing: { id: string; name: string; slug: string; agentId: string | null }, outcome: ReviewOutcome, note: string | null, live: boolean) {
  if (listing.agentId) {
    const agentId = listing.agentId;
    after(() => sendReviewOutcome(listing, agentId, outcome, note));
  }
  revalidateListings(live);
  revalidatePath('/agent', 'layout');
}

function parseNote(note: unknown): { ok: true; note: string } | { ok: false; error: string } {
  const parsed = ReviewNoteSchema.safeParse(note);
  return parsed.success ? { ok: true, note: parsed.data } : { ok: false, error: parsed.error.issues[0]?.message ?? 'Add a note for the agent.' };
}

// ── New listings ────────────────────────────────────────────────────────────

/** Waiting for review → live. */
export async function approveListing(id: unknown): Promise<ReviewResult> {
  const admin = await assertAdmin();
  const listing = await load(id);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'PENDING_REVIEW') return { ok: false, error: NOT_WAITING };
  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: listing.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: listing.publishedAt ?? new Date(),
          submittedAt: null,
          reviewNote: null,
          reviewedAt: new Date(),
          updatedById: admin.id,
        },
      }),
      prisma.auditLog.create({
        data: { action: 'APPROVE', entityType: 'Property', entityId: listing.id, changes: { status: { from: 'PENDING_REVIEW', to: 'PUBLISHED' } }, actorId: admin.id },
      }),
    ]);
  } catch (error) {
    console.error('approveListing failed:', error);
    return { ok: false, error: FAILED };
  }
  finish(listing, 'approved', null, true);
  return { ok: true, message: `“${listing.name}” is live.` };
}

/** Back to the agent as a draft, with a note saying what to change. Works for changes to live listings too. */
export async function sendBack(id: unknown, note: unknown): Promise<ReviewResult> {
  const admin = await assertAdmin();
  const checkedNote = parseNote(note);
  if (!checkedNote.ok) return checkedNote;
  const listing = await load(id);
  if (!listing) return { ok: false, error: GONE };

  const isNew = listing.status === 'PENDING_REVIEW';
  if (!isNew && !(listing.submittedAt && listing.pendingChanges)) return { ok: false, error: NOT_WAITING };
  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: listing.id },
        data: {
          ...(isNew ? { status: 'DRAFT' as const } : {}),
          submittedAt: null,
          reviewNote: checkedNote.note,
          reviewedAt: new Date(),
          updatedById: admin.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'SEND_BACK',
          entityType: 'Property',
          entityId: listing.id,
          changes: { ...(isNew ? { status: { from: 'PENDING_REVIEW', to: 'DRAFT' } } : { changes: 'sent back' }), note: checkedNote.note },
          actorId: admin.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('sendBack failed:', error);
    return { ok: false, error: FAILED };
  }
  finish(listing, isNew ? 'sent-back' : 'changes-sent-back', checkedNote.note, false);
  return { ok: true, message: isNew ? `“${listing.name}” went back to the agent.` : 'The changes went back to the agent. The live listing hasn’t changed.' };
}

/** Turned down for good: a new listing becomes Rejected; changes to a live listing are discarded. */
export async function reject(id: unknown, note: unknown): Promise<ReviewResult> {
  const admin = await assertAdmin();
  const checkedNote = parseNote(note);
  if (!checkedNote.ok) return checkedNote;
  const listing = await load(id);
  if (!listing) return { ok: false, error: GONE };

  const isNew = listing.status === 'PENDING_REVIEW';
  if (!isNew && !(listing.submittedAt && listing.pendingChanges)) return { ok: false, error: NOT_WAITING };
  try {
    if (isNew) {
      await prisma.property.update({
        where: { id: listing.id },
        data: { status: 'REJECTED', submittedAt: null, reviewNote: checkedNote.note, reviewedAt: new Date(), updatedById: admin.id },
      });
    } else {
      const keys = await clearPendingChanges(listing.id);
      await prisma.property.update({ where: { id: listing.id }, data: { reviewNote: checkedNote.note, reviewedAt: new Date() } });
      after(() => removeStoredFiles(keys.media, keys.documents));
    }
    await prisma.auditLog.create({
      data: {
        action: 'REJECT',
        entityType: 'Property',
        entityId: listing.id,
        changes: { ...(isNew ? { status: { from: 'PENDING_REVIEW', to: 'REJECTED' } } : { changes: 'discarded' }), note: checkedNote.note },
        actorId: admin.id,
      },
    });
  } catch (error) {
    console.error('reject failed:', error);
    return { ok: false, error: FAILED };
  }
  finish(listing, isNew ? 'rejected' : 'changes-rejected', checkedNote.note, false);
  return { ok: true, message: isNew ? `“${listing.name}” was rejected.` : 'The changes were discarded. The live listing hasn’t changed.' };
}

// ── Changes to live listings ────────────────────────────────────────────────

/**
 * Applies an agent's proposed edits to the live listing: the details (checked
 * again with the same rules as the form), the amenities, and the photo and
 * document lists, including their pending uploads. Status and Featured stay as
 * they are.
 */
export async function approveChanges(id: unknown): Promise<ReviewResult> {
  const admin = await assertAdmin();
  const listing = await load(id);
  if (!listing) return { ok: false, error: GONE };
  const pending = readPendingChanges(listing.pendingChanges);
  if (listing.status !== 'PUBLISHED' || !listing.submittedAt || !pending) return { ok: false, error: NOT_WAITING };

  const changes: Record<string, unknown> = {};
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let slug = listing.slug;
  let data: Record<string, unknown> = {};

  if (pending.values) {
    const checked = await checkInput({ ...pending.values, status: listing.status, isFeatured: listing.isFeatured });
    if (!checked.ok) {
      const first = Object.entries(checked.fieldErrors ?? {}).find(([, v]) => v?.length);
      return {
        ok: false,
        error: `The changes don’t pass the listing checks${first ? ` (${first[0]}: ${first[1]![0]})` : ''}. Send them back to the agent.`,
      };
    }
    slug = checked.data.slug;
    if (slug !== listing.slug && (await slugTaken(slug, listing.id))) slug = await freeSlug(slug, listing.id);
    data = { ...checked.data, slug };
    Object.assign(changes, diff(listing, data));
    const before = listing.amenities.map(a => a.amenityId).sort((a, b) => a - b);
    const afterIds = [...checked.amenityIds].sort((a, b) => a - b);
    if (before.join() !== afterIds.join()) {
      changes.amenityIds = { from: before, to: afterIds };
      writes.push(prisma.propertyAmenity.deleteMany({ where: { propertyId: listing.id } }));
      if (afterIds.length) writes.push(prisma.propertyAmenity.createMany({ data: afterIds.map(amenityId => ({ propertyId: listing.id, amenityId })) }));
    }
  }

  // Photos: the agent's list is the new list. Anything not on it goes.
  const media = await prisma.propertyMedia.findMany({ where: { propertyId: listing.id }, select: { id: true, storageKey: true, pendingReview: true } });
  const removedMedia: string[] = [];
  if (pending.photos) {
    const order = pending.photos.filter(p => media.some(m => m.id === p.id));
    const keep = new Set(order.map(p => p.id));
    const gone = media.filter(m => !keep.has(m.id));
    removedMedia.push(...gone.map(m => m.storageKey).filter((k): k is string => !!k && !k.startsWith('seed/')));
    const added = order.filter(p => media.find(m => m.id === p.id)?.pendingReview).length;
    const removed = gone.filter(m => !m.pendingReview).length;
    if (added || removed) changes.photos = [added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(', ');
    writes.push(
      prisma.propertyMedia.deleteMany({ where: { id: { in: gone.map(m => m.id) } } }),
      prisma.propertyMedia.updateMany({ where: { propertyId: listing.id, isCover: true }, data: { isCover: false } }),
      ...order.map((p, i) =>
        prisma.propertyMedia.update({ where: { id: p.id }, data: { sortOrder: i, isCover: i === 0, altText: p.altText ?? null, pendingReview: false } }),
      ),
    );
  } else if (media.some(m => m.pendingReview)) {
    writes.push(prisma.propertyMedia.updateMany({ where: { propertyId: listing.id, pendingReview: true }, data: { pendingReview: false } }));
  }

  // Documents: same idea.
  const docs = await prisma.propertyDocument.findMany({ where: { propertyId: listing.id }, select: { id: true, storageKey: true, pendingReview: true } });
  const removedDocs: string[] = [];
  if (pending.documents) {
    const list = pending.documents.filter(d => docs.some(x => x.id === d.id));
    const keep = new Set(list.map(d => d.id));
    const gone = docs.filter(d => !keep.has(d.id));
    removedDocs.push(...gone.map(d => d.storageKey));
    const added = list.filter(d => docs.find(x => x.id === d.id)?.pendingReview).length;
    const removed = gone.filter(d => !d.pendingReview).length;
    if (added || removed) changes.documents = [added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(', ');
    writes.push(
      prisma.propertyDocument.deleteMany({ where: { id: { in: gone.map(d => d.id) } } }),
      ...list.map(d =>
        prisma.propertyDocument.update({
          where: { id: d.id },
          data: { name: d.name, type: d.type as DocumentType, isPublic: d.isPublic, pendingReview: false },
        }),
      ),
    );
  } else if (docs.some(d => d.pendingReview)) {
    writes.push(prisma.propertyDocument.updateMany({ where: { propertyId: listing.id, pendingReview: true }, data: { pendingReview: false } }));
  }

  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: listing.id },
        data: {
          ...(data as Prisma.PropertyUpdateInput),
          pendingChanges: Prisma.DbNull,
          submittedAt: null,
          reviewNote: null,
          reviewedAt: new Date(),
          updatedById: admin.id,
        },
      }),
      ...writes,
      prisma.auditLog.create({
        data: { action: 'APPROVE', entityType: 'Property', entityId: listing.id, changes: changes as Prisma.InputJsonValue, actorId: admin.id },
      }),
    ]);
  } catch (error) {
    console.error('approveChanges failed:', error);
    return { ok: false, error: FAILED };
  }
  after(() => removeStoredFiles(removedMedia, removedDocs));
  finish({ ...listing, slug }, 'changes-approved', null, true);
  return { ok: true, message: 'The changes are live.' };
}
