import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ListingStatusBadge } from '@/components/admin/badges';
import { AdminPageHeader } from '@/components/admin/page-header';
import { PropertyForm } from '@/components/admin/property-form/property-form';
import { toFormValues } from '@/components/admin/property-form/values';
import { buttonVariants } from '@/components/ui/button';
import { getPropertyForEdit, listAmenities } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatRelativeTime } from '@/lib/format';
import { uuid } from '@/schemas/fields';

export const metadata = { title: 'Edit property' };

/** The admin view of a property is its edit form. */
export default async function EditPropertyPage({ params }: PageProps<'/admin/properties/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/admin/properties/${id}`);
  if (!uuid().safeParse(id).success) notFound();

  const [property, amenities] = await Promise.all([getPropertyForEdit(id), listAmenities()]);
  if (!property) notFound();

  return (
    <>
      <AdminPageHeader
        title={property.name}
        description={
          <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <ListingStatusBadge status={property.status} />
            <span>Ref PRP-{String(property.refNumber).padStart(5, '0')}</span>
            <span>Updated {formatRelativeTime(property.updatedAt)}</span>
          </span>
        }
        actions={
          <Link
            href='/admin/properties'
            className={buttonVariants({ variant: 'ghost' })}>
            <ArrowLeft aria-hidden />
            All properties
          </Link>
        }
      />
      <PropertyForm
        amenities={amenities.map(({ id, name, group }) => ({ id, name, group }))}
        property={{
          id: property.id,
          values: toFormValues(
            property,
            property.amenities.map(a => a.amenityId),
          ),
          photos: property.media.map(m => ({ kind: 'saved', id: m.id, url: m.url, altText: m.altText ?? '' })),
          documents: property.documents.map(d => ({ kind: 'saved', ...d })),
        }}
      />
    </>
  );
}
