'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import * as z from 'zod';
import { assertAgent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { sendSubmittedAlert } from '@/lib/email/agents';
import { clearPendingChanges, readPendingChanges } from '@/lib/listings/pending';
import {
  SAVE_FAILED,
  checkInput,
  freeSlug,
  isUniqueSlugError,
  removeStoredFiles,
  revalidateListings,
  slugError,
  slugTaken,
  type SavePropertyResult,
} from '@/lib/listings/property-write';
import { uuid } from '@/schemas/fields';

/**
 * What an agent can do with their own listings. Every action checks the
 * listing belongs to the signed-in agent. Agents never publish, feature or
 * archive: an admin reviews every new listing and every change to a live one.
 */

export type AgentActionResult = { ok: true; message: string } | { ok: false; error: string };

const GONE = 'That listing no longer exists. Refresh the page.';
const FAILED = "That didn't work. Try again in a moment.";

/** Forces the agent-only rules onto whatever the form sent. */
const asAgentInput = (values: unknown) => ({ ...(values as object), status: 'DRAFT', isFeatured: false });

async function ownListing(agentId: string, id: unknown) {
  const parsed = uuid().safeParse(id);
  if (!parsed.success) return null;
  return prisma.property.findFirst({
    where: { id: parsed.data, agentId, deletedAt: null },
    select: { id: true, name: true, slug: true, status: true, pendingChanges: true, submittedAt: true, publishedAt: true },
  });
}

function refresh() {
  revalidatePath('/agent', 'layout');
  revalidatePath('/admin', 'layout');
}

/**
 * Creates a draft, or saves changes to one of the agent's drafts (including one
 * sent back with a note). Photos and documents upload afterwards, as for admins.
 */
export async function saveAgentDraft(input: unknown): Promise<SavePropertyResult> {
  const agent = await assertAgent();
  const rawId = (input as { id?: unknown } | null)?.id;
  const checked = await checkInput(asAgentInput((input as { values?: unknown } | null)?.values));
  if (!checked.ok) return checked;
  const { data, amenityIds, slugWasTyped } = checked;

  if (rawId === undefined || rawId === null) {
    let slug = data.slug;
    if (slugWasTyped) {
      if (await slugTaken(slug)) return slugError();
    } else slug = await freeSlug(slug);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const created = await prisma.$transaction(async tx => {
          const row = await tx.property.create({
            data: {
              ...data,
              slug,
              status: 'DRAFT',
              isFeatured: false,
              agentId: agent.id,
              createdById: agent.id,
              updatedById: agent.id,
              amenities: { create: amenityIds.map(amenityId => ({ amenityId })) },
            },
            select: { id: true, slug: true },
          });
          await tx.auditLog.create({
            data: { action: 'CREATE', entityType: 'Property', entityId: row.id, changes: { name: data.name, status: 'DRAFT' }, actorId: agent.id },
          });
          return row;
        });
        refresh();
        return { ok: true, data: created };
      } catch (error) {
        if (isUniqueSlugError(error)) {
          if (slugWasTyped) return slugError();
          slug = await freeSlug(data.slug);
          continue;
        }
        console.error('saveAgentDraft (create) failed:', error);
        return { ok: false, error: SAVE_FAILED };
      }
    }
    return { ok: false, error: SAVE_FAILED };
  }

  const listing = await ownListing(agent.id, rawId);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'DRAFT') return { ok: false, error: 'Only drafts can be saved like this. Refresh the page.' };

  let slug = data.slug;
  if (slug !== listing.slug) {
    if (slugWasTyped) {
      if (await slugTaken(slug, listing.id)) return slugError();
    } else slug = await freeSlug(slug, listing.id);
  }
  try {
    await prisma.$transaction(async tx => {
      await tx.property.update({
        where: { id: listing.id },
        data: { ...data, slug, status: 'DRAFT', isFeatured: false, updatedById: agent.id },
      });
      await tx.propertyAmenity.deleteMany({ where: { propertyId: listing.id } });
      if (amenityIds.length > 0) {
        await tx.propertyAmenity.createMany({ data: amenityIds.map(amenityId => ({ propertyId: listing.id, amenityId })) });
      }
      await tx.auditLog.create({
        data: { action: 'UPDATE', entityType: 'Property', entityId: listing.id, changes: { draft: 'saved' }, actorId: agent.id },
      });
    });
  } catch (error) {
    if (isUniqueSlugError(error)) return slugError();
    console.error('saveAgentDraft (update) failed:', error);
    return { ok: false, error: SAVE_FAILED };
  }
  refresh();
  return { ok: true, data: { id: listing.id, slug } };
}

/** Draft → waiting for review. Needs at least one photo. */
export async function submitForReview(id: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'DRAFT') return { ok: false, error: 'This listing has already been submitted. Refresh the page.' };
  const photos = await prisma.propertyMedia.count({ where: { propertyId: listing.id, type: 'IMAGE' } });
  if (photos === 0) return { ok: false, error: 'Add at least one photo before you submit.' };

  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: listing.id },
        data: { status: 'PENDING_REVIEW', submittedAt: new Date(), reviewNote: null, updatedById: agent.id },
      }),
      prisma.auditLog.create({
        data: {
          action: 'SUBMIT',
          entityType: 'Property',
          entityId: listing.id,
          changes: { status: { from: 'DRAFT', to: 'PENDING_REVIEW' } },
          actorId: agent.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('submitForReview failed:', error);
    return { ok: false, error: FAILED };
  }
  after(() => sendSubmittedAlert(listing, agent.name || agent.email, 'new'));
  refresh();
  return { ok: true, message: `“${listing.name}” is with the team for review.` };
}

/** Waiting for review → draft, so the agent can change it. */
export async function withdrawSubmission(id: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'PENDING_REVIEW') return { ok: false, error: 'This listing isn’t waiting for review. Refresh the page.' };
  try {
    await prisma.$transaction([
      prisma.property.update({ where: { id: listing.id }, data: { status: 'DRAFT', submittedAt: null, updatedById: agent.id } }),
      prisma.auditLog.create({
        data: {
          action: 'STATUS_CHANGE',
          entityType: 'Property',
          entityId: listing.id,
          changes: { status: { from: 'PENDING_REVIEW', to: 'DRAFT' }, withdrawn: true },
          actorId: agent.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('withdrawSubmission failed:', error);
    return { ok: false, error: FAILED };
  }
  refresh();
  return { ok: true, message: `“${listing.name}” is back in your drafts.` };
}

/**
 * Proposed edits to a live listing. Stored apart from the live listing (which
 * doesn't change) until an admin approves them. Photos and documents follow
 * through the usual upload actions, which keep them pending too.
 */
export async function proposeChanges(input: unknown): Promise<SavePropertyResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, (input as { id?: unknown } | null)?.id);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'PUBLISHED') return { ok: false, error: 'This listing isn’t live. Refresh the page.' };

  const values = asAgentInput((input as { values?: unknown } | null)?.values);
  const checked = await checkInput(values);
  if (!checked.ok) return checked;
  if (checked.data.slug !== listing.slug && (await slugTaken(checked.data.slug, listing.id))) return slugError();

  try {
    await prisma.$executeRaw`
      UPDATE "properties"
      SET "pendingChanges" = COALESCE("pendingChanges", '{}'::jsonb) || ${JSON.stringify({ values })}::jsonb
      WHERE "id" = ${listing.id}::uuid`;
  } catch (error) {
    console.error('proposeChanges failed:', error);
    return { ok: false, error: SAVE_FAILED };
  }
  return { ok: true, data: { id: listing.id, slug: listing.slug } };
}

/** Sends the proposed changes to the team. Called after the details and files are saved. */
export async function submitChangesForReview(id: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  if (!listing) return { ok: false, error: GONE };
  if (listing.status !== 'PUBLISHED' || !readPendingChanges(listing.pendingChanges)) {
    return { ok: false, error: 'There are no changes to send. Refresh the page.' };
  }
  const firstTime = listing.submittedAt === null;
  try {
    await prisma.$transaction([
      prisma.property.update({ where: { id: listing.id }, data: { submittedAt: new Date(), reviewNote: null } }),
      prisma.auditLog.create({
        data: { action: 'SUBMIT', entityType: 'Property', entityId: listing.id, changes: { changes: 'submitted' }, actorId: agent.id },
      }),
    ]);
  } catch (error) {
    console.error('submitChangesForReview failed:', error);
    return { ok: false, error: FAILED };
  }
  if (firstTime) after(() => sendSubmittedAlert(listing, agent.name || agent.email, 'changes'));
  refresh();
  return { ok: true, message: 'Your changes are with the team. The live listing stays as it is until they’re approved.' };
}

/** Throws away the agent's proposed edits to a live listing, including pending uploads. */
export async function discardChanges(id: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  if (!listing) return { ok: false, error: GONE };
  try {
    const keys = await clearPendingChanges(listing.id);
    await prisma.auditLog.create({
      data: { action: 'UPDATE', entityType: 'Property', entityId: listing.id, changes: { changes: 'discarded' }, actorId: agent.id },
    });
    after(() => removeStoredFiles(keys.media, keys.documents));
  } catch (error) {
    console.error('discardChanges failed:', error);
    return { ok: false, error: FAILED };
  }
  refresh();
  return { ok: true, message: 'Your changes were discarded. The live listing hasn’t changed.' };
}

const AvailabilitySchema = z.enum(['AVAILABLE', 'UNDER_OFFER', 'SOLD', 'RENTED', 'OFF_MARKET']);
const AVAILABILITY_WORDS: Record<z.infer<typeof AvailabilitySchema>, string> = {
  AVAILABLE: 'available',
  UNDER_OFFER: 'under offer',
  SOLD: 'sold',
  RENTED: 'rented',
  OFF_MARKET: 'off the market',
};

/** Under offer, sold, rented: changes at once on a live listing, no review needed. */
export async function setListingAvailability(id: unknown, availability: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  const next = AvailabilitySchema.safeParse(availability);
  if (!listing || !next.success) return { ok: false, error: GONE };
  if (listing.status !== 'PUBLISHED') return { ok: false, error: 'Only live listings can be marked like this.' };
  try {
    const current = await prisma.property.findUnique({ where: { id: listing.id }, select: { availability: true } });
    if (current?.availability === next.data) return { ok: true, message: `Already marked ${AVAILABILITY_WORDS[next.data]}.` };
    await prisma.$transaction([
      prisma.property.update({ where: { id: listing.id }, data: { availability: next.data, updatedById: agent.id } }),
      prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'Property',
          entityId: listing.id,
          changes: { availability: { from: current?.availability ?? null, to: next.data } },
          actorId: agent.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('setListingAvailability failed:', error);
    return { ok: false, error: FAILED };
  }
  revalidateListings(true);
  refresh();
  return { ok: true, message: `“${listing.name}” is marked ${AVAILABILITY_WORDS[next.data]}.` };
}

/** Deletes a draft that never went live. Admins can still restore it from Deleted. */
export async function deleteAgentDraft(id: unknown): Promise<AgentActionResult> {
  const agent = await assertAgent();
  const listing = await ownListing(agent.id, id);
  if (!listing) return { ok: false, error: GONE };
  if (!(listing.status === 'DRAFT' || listing.status === 'REJECTED') || listing.publishedAt) {
    return { ok: false, error: 'Only drafts that were never live can be deleted. Ask the team about this one.' };
  }
  try {
    await prisma.$transaction([
      prisma.property.update({ where: { id: listing.id }, data: { deletedAt: new Date(), updatedById: agent.id } }),
      prisma.auditLog.create({ data: { action: 'DELETE', entityType: 'Property', entityId: listing.id, changes: { name: listing.name }, actorId: agent.id } }),
    ]);
  } catch (error) {
    console.error('deleteAgentDraft failed:', error);
    return { ok: false, error: FAILED };
  }
  refresh();
  return { ok: true, message: `Deleted “${listing.name}”.` };
}

