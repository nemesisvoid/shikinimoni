import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/page-header';
import { PropertyForm } from '@/components/admin/property-form/property-form';
import { buttonVariants } from '@/components/ui/button';
import { listAmenities } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Add property' };

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function NewPropertyPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewPropertyPageContent />
    </Suspense>
  );
}

async function NewPropertyPageContent() {
  await requireAdminPage('/admin/properties/new');
  const amenities = await listAmenities();

  return (
    <>
      <AdminPageHeader
        title='Add property'
        description='Photos and documents upload when you save.'
        actions={
          <Link href='/admin/properties' className={buttonVariants({ variant: 'ghost' })}>
            <ArrowLeft aria-hidden />
            All properties
          </Link>
        }
      />
      <PropertyForm amenities={amenities.map(({ id, name, group }) => ({ id, name, group }))} />
    </>
  );
}
