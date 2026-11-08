import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/page-header';
import { PropertyForm } from '@/components/admin/property-form/property-form';
import { buttonVariants } from '@/components/ui/button';
import { listAmenities } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Add property' };

export default async function NewPropertyPage() {
  await requireAdminPage('/admin/properties/new');
  const amenities = await listAmenities();

  return (
    <>
      <AdminPageHeader
        title='Add property'
        description='Photos and documents can be added once the property is saved.'
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
