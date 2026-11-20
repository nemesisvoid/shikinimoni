import 'server-only';
import { describePropertyChanges, type ActivityDetail } from '@/lib/admin/activity';
import type { getPropertyForEdit } from '@/lib/admin/queries';
import { prisma } from '@/lib/db';
import { readPendingChanges } from '@/lib/listings/pending';
import { checkInput, diff } from '@/lib/listings/property-write';

type EditProperty = NonNullable<Awaited<ReturnType<typeof getPropertyForEdit>>>;

export type ReviewSummary =
  | { kind: 'new'; agentName: string; submittedAt: Date }
  | {
      kind: 'changes';
      agentName: string;
      submittedAt: Date;
      fields: ActivityDetail[];
      /** Set when the proposed values no longer pass the form's checks (e.g. an amenity was deleted since). */
      problem: string | null;
      photosAdded: { id: string; url: string }[];
      photosRemoved: { id: string; url: string }[];
      coverChanged: boolean;
      documentsAdded: string[];
      documentsRemoved: string[];
    }
  | { kind: 'changes-returned'; agentName: string; note: string | null };

/** What the admin is being asked to review on this listing, if anything. */
export async function getReviewSummary(property: EditProperty): Promise<ReviewSummary | null> {
  const agentName = property.agent?.user.name || property.agent?.user.email || 'A former agent';
  const pending = readPendingChanges(property.pendingChanges);

  if (property.status === 'PENDING_REVIEW') return { kind: 'new', agentName, submittedAt: property.submittedAt ?? property.updatedAt };
  if (!pending) return null;
  if (!property.submittedAt) return { kind: 'changes-returned', agentName, note: property.reviewNote };

  let fields: ActivityDetail[] = [];
  let problem: string | null = null;
  if (pending.values) {
    const checked = await checkInput({ ...pending.values, status: property.status, isFeatured: property.isFeatured });
    if (checked.ok) {
      const changes: Record<string, unknown> = diff(property, checked.data);
      const before = property.amenities.map(a => a.amenityId).sort((a, b) => a - b);
      const after = [...checked.amenityIds].sort((a, b) => a - b);
      if (before.join() !== after.join()) changes.amenityIds = { from: before, to: after };
      const amenityIds = [...new Set([...before, ...after])];
      const amenities = await prisma.amenity.findMany({ where: { id: { in: amenityIds } }, select: { id: true, name: true } });
      fields = describePropertyChanges(changes, new Map(amenities.map(a => [a.id, a.name])));
    } else {
      const first = Object.entries(checked.fieldErrors ?? {}).find(([, v]) => v?.length);
      problem = first ? `${first[0]}: ${first[1]![0]}` : checked.error;
    }
  }

  const live = property.allMedia.filter(m => !m.pendingReview);
  const order = pending.photos?.map(p => p.id);
  const photosAdded = property.allMedia.filter(m => m.pendingReview && (!order || order.includes(m.id)));
  const photosRemoved = order ? live.filter(m => !order.includes(m.id)) : [];
  const liveCover = live.find(m => m.isCover)?.id ?? live[0]?.id;
  const coverChanged = !!order && order[0] !== undefined && order[0] !== liveCover;

  const docOrder = pending.documents?.map(d => d.id);
  const documentsAdded = property.allDocuments.filter(d => d.pendingReview && (!docOrder || docOrder.includes(d.id))).map(d => d.name);
  const documentsRemoved = docOrder ? property.allDocuments.filter(d => !d.pendingReview && !docOrder.includes(d.id)).map(d => d.name) : [];

  return {
    kind: 'changes',
    agentName,
    submittedAt: property.submittedAt,
    fields,
    problem,
    photosAdded: photosAdded.map(m => ({ id: m.id, url: m.url })),
    photosRemoved: photosRemoved.map(m => ({ id: m.id, url: m.url })),
    coverChanged,
    documentsAdded,
    documentsRemoved,
  };
}
