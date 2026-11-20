import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { AgentListingActions } from '@/components/agent/listing-actions';
import { STAGE_META, StageBadge } from '@/components/agent/stage-badge';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { PropertyForm } from '@/components/admin/property-form/property-form';
import { buttonVariants } from '@/components/ui/button';
import { listAmenities } from '@/lib/admin/queries';
import { getAgentListingForEdit } from '@/lib/agents/queries';
import { requireAgentPage } from '@/lib/auth/guards';
import { formatRelativeTime } from '@/lib/format';
import { propertyPath } from '@/lib/listings/search';
import { uuid } from '@/schemas/fields';

export const metadata = { title: 'Edit listing' };

export default function AgentEditPropertyPage(props: PageProps<'/agent/properties/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AgentEditProperty {...props} />
    </Suspense>
  );
}

async function AgentEditProperty({ params }: PageProps<'/agent/properties/[id]'>) {
  const { id } = await params;
  const { user } = await requireAgentPage(`/agent/properties/${id}`);
  if (!uuid().safeParse(id).success) notFound();
  const [listing, amenities] = await Promise.all([getAgentListingForEdit(id, user.id), listAmenities()]);
  if (!listing) notFound();
  const { property, stage } = listing;

  const live = stage.startsWith('live');
  const editable = stage === 'draft' || stage === 'sent-back' || live;
  const note = property.reviewNote && (stage === 'sent-back' || stage === 'live-changes-sent-back' || stage === 'rejected') ? property.reviewNote : null;

  return (
    <>
      <AdminPageHeader
        title={property.name}
        description={
          <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <StageBadge stage={stage} />
            <span>Ref PRP-{String(property.refNumber).padStart(5, '0')}</span>
            <span>Updated {formatRelativeTime(property.updatedAt)}</span>
          </span>
        }
        actions={
          <>
            <Link
              href='/agent/properties'
              className={buttonVariants({ variant: 'ghost' })}>
              <ArrowLeft aria-hidden />
              Your listings
            </Link>
            {live && (
              <a
                href={propertyPath(property.slug)}
                target='_blank'
                rel='noopener'
                className={buttonVariants({ variant: 'outline' })}>
                View on site
                <ExternalLink aria-hidden />
              </a>
            )}
            <AgentListingActions
              listing={{
                id: property.id,
                name: property.name,
                slug: property.slug,
                stage,
                availability: property.availability,
                neverLive: property.publishedAt === null,
              }}
            />
          </>
        }
      />

      {note && (
        <div
          role='note'
          className='rounded-2xl border border-sunset-200 bg-sunset-50 p-4 text-sunset-950'>
          <p className='font-medium'>{stage === 'rejected' ? 'Why it wasn’t approved' : 'The team asked for changes'}</p>
          <p className='mt-1 text-sm whitespace-pre-line'>{note}</p>
        </div>
      )}

      {live && (
        <div className='rounded-2xl border border-azure-200 bg-azure-50 p-4 text-sm text-azure-900'>
          {stage === 'live-changes-pending'
            ? 'Your changes are with the team. The live listing stays as it was until they approve them. You can keep editing; the team sees your latest version.'
            : stage === 'live-changes-sent-back'
              ? 'Your changes haven’t gone live. Update them using the note above, then submit them again.'
              : 'This listing is live. Edit it below and submit your changes: the team checks them before they replace what’s on the site. To mark it sold or rented straight away, use the ⋯ menu.'}
        </div>
      )}

      {editable ? (
        <PropertyForm
          amenities={amenities.map(({ id, name, group }) => ({ id, name, group }))}
          mode={{ kind: 'agent', live }}
          property={{
            id: property.id,
            values: listing.values,
            photos: listing.photos.map(m => ({ kind: 'saved', id: m.id, url: m.url, altText: m.altText ?? '' })),
            documents: listing.documents.map(d => ({ kind: 'saved', id: d.id, name: d.name, type: d.type, isPublic: d.isPublic, mimeType: d.mimeType, sizeBytes: d.sizeBytes })),
          }}
        />
      ) : (
        <div className='max-w-2xl rounded-2xl border bg-card p-6'>
          <h2 className='font-heading text-lg font-bold'>{STAGE_META[stage].label}</h2>
          <p className='mt-1 text-muted-foreground'>
            {stage === 'pending'
              ? `Submitted ${formatRelativeTime(property.submittedAt ?? property.updatedAt)}. ${STAGE_META[stage].next} You’ll get an email when they do. To change something first, withdraw it from the ⋯ menu.`
              : STAGE_META[stage].next}
          </p>
        </div>
      )}
    </>
  );
}
