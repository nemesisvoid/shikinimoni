import 'server-only';
import { EMPTY_PROPERTY, toFormValues, type PropertyFormValues } from '@/components/admin/property-form/values';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { readPendingChanges } from '@/lib/listings/pending';

/**
 * Reads for the agent area. Every query is scoped to one agent's listings;
 * callers pass the id from requireAgentPage().
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
/** The first day of the last 30, Lagos time, as a date. */
const thirtyDaysAgo = () => {
  const now = new Date(Date.now() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
};

const rowSelect = {
  id: true,
  name: true,
  slug: true,
  refNumber: true,
  status: true,
  availability: true,
  neighborhood: true,
  city: true,
  state: true,
  updatedAt: true,
  publishedAt: true,
  submittedAt: true,
  reviewNote: true,
  pendingChanges: true,
  media: { where: { isCover: true, pendingReview: false }, take: 1, select: { url: true, altText: true } },
} satisfies Prisma.PropertySelect;

type Row = Prisma.PropertyGetPayload<{ select: typeof rowSelect }>;

/** Where a listing stands, from the agent's side. Drives the badge and the next step shown. */
export type AgentListingStage = 'draft' | 'sent-back' | 'pending' | 'live' | 'live-changes-pending' | 'live-changes-sent-back' | 'rejected' | 'archived';

export function stageOf(row: Pick<Row, 'status' | 'submittedAt' | 'reviewNote' | 'pendingChanges'>): AgentListingStage {
  if (row.status === 'DRAFT') return row.reviewNote ? 'sent-back' : 'draft';
  if (row.status === 'PENDING_REVIEW') return 'pending';
  if (row.status === 'REJECTED') return 'rejected';
  if (row.status === 'ARCHIVED') return 'archived';
  if (row.pendingChanges && row.submittedAt) return 'live-changes-pending';
  if (row.pendingChanges && row.reviewNote) return 'live-changes-sent-back';
  return 'live';
}

export const needsAgentAttention = (stage: AgentListingStage) => stage === 'sent-back' || stage === 'live-changes-sent-back';

async function views30(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await prisma.propertyViewDay.groupBy({
    by: ['propertyId'],
    where: { propertyId: { in: ids }, day: { gte: thirtyDaysAgo() } },
    _sum: { views: true },
  });
  return new Map(rows.map(r => [r.propertyId, r._sum.views ?? 0]));
}

/** All the agent's listings, most recently updated first, with views over the last 30 days. */
export async function listAgentListings(agentId: string) {
  const rows = await prisma.property.findMany({
    where: { agentId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: rowSelect,
  });
  const views = await views30(rows.map(r => r.id));
  return rows.map(({ pendingChanges, ...r }) => ({
    ...r,
    hasPendingChanges: pendingChanges !== null,
    stage: stageOf({ ...r, pendingChanges }),
    views30: views.get(r.id) ?? 0,
  }));
}
export type AgentListingRow = Awaited<ReturnType<typeof listAgentListings>>[number];

/** Listings sent back to the agent (new ones or changes) that they haven't resubmitted. */
export async function countNeedsAttention(agentId: string) {
  const rows = await prisma.property.findMany({
    where: { agentId, deletedAt: null, reviewNote: { not: null }, status: { in: ['DRAFT', 'PUBLISHED'] } },
    select: { status: true, submittedAt: true, reviewNote: true, pendingChanges: true },
  });
  return rows.filter(r => needsAgentAttention(stageOf(r))).length;
}

/**
 * One of the agent's listings for the edit form. A live listing with proposed
 * changes shows those changes (values, photo and document lists including
 * pending uploads), so the agent keeps working on their version.
 */
export async function getAgentListingForEdit(id: string, agentId: string) {
  const property = await prisma.property.findFirst({
    where: { id, agentId, deletedAt: null },
    include: {
      amenities: { select: { amenityId: true } },
      media: {
        where: { type: 'IMAGE' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, altText: true, isCover: true, pendingReview: true },
      },
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, type: true, isPublic: true, mimeType: true, sizeBytes: true, pendingReview: true },
      },
    },
  });
  if (!property) return null;

  // Proposed changes only apply to a live listing.
  const pending = property.status === 'PUBLISHED' ? readPendingChanges(property.pendingChanges) : null;
  const live = toFormValues(property, property.amenities.map(a => a.amenityId));
  const values: PropertyFormValues = pending?.values ? { ...EMPTY_PROPERTY, ...live, ...(pending.values as Partial<PropertyFormValues>) } : live;

  const livePhotos = property.media.filter(m => !m.pendingReview).sort((a, b) => Number(b.isCover) - Number(a.isCover));
  const photos = pending?.photos
    ? pending.photos.flatMap(p => {
        const m = property.media.find(x => x.id === p.id);
        return m ? [{ ...m, altText: p.altText ?? m.altText }] : [];
      })
    : [...livePhotos, ...property.media.filter(m => m.pendingReview)];

  const documents = pending?.documents
    ? pending.documents.flatMap(d => {
        const doc = property.documents.find(x => x.id === d.id);
        return doc ? [{ ...doc, name: d.name, type: d.type as typeof doc.type, isPublic: d.isPublic }] : [];
      })
    : property.documents;

  return { property, values, photos, documents, stage: stageOf(property) };
}

/** The agent dashboard: counts by stage, what needs attention, and recent views. */
export async function getAgentOverview(agentId: string) {
  const listings = await listAgentListings(agentId);
  const by = (stages: AgentListingStage[]) => listings.filter(l => stages.includes(l.stage)).length;
  return {
    listings,
    live: by(['live', 'live-changes-pending', 'live-changes-sent-back']),
    pending: by(['pending', 'live-changes-pending']),
    drafts: by(['draft']),
    attention: listings.filter(l => needsAgentAttention(l.stage)),
    views30: listings.reduce((sum, l) => sum + l.views30, 0),
  };
}
