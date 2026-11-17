import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { AmenitiesManager } from '@/components/admin/amenities-manager';
import { AdminPageHeader } from '@/components/admin/page-header';
import { listAmenities } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Amenities' };

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function AdminAmenitiesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminAmenitiesPageContent />
    </Suspense>
  );
}

async function AdminAmenitiesPageContent() {
  await requireAdminPage('/admin/amenities');
  const amenities = await listAmenities();

  return (
    <>
      <AdminPageHeader
        title='Amenities'
        description='Features you can tick on a listing, grouped the way buyers scan for them. Changes show on the site straight away.'
      />
      <AmenitiesManager
        amenities={amenities.map(a => ({ id: a.id, name: a.name, group: a.group, listings: a._count.properties }))}
      />
    </>
  );
}
