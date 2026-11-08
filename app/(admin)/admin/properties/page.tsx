import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { PropertiesTable } from '@/components/admin/properties-table';
import { buttonVariants } from '@/components/ui/button';
import { listAdminProperties } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Properties' };

export default async function AdminPropertiesPage() {
  await requireAdminPage('/admin/properties');
  const rows = await listAdminProperties();
  const addButton = (
    <Link href='/admin/properties/new' className={buttonVariants({ size: 'lg' })}>
      <Plus aria-hidden />
      Add property
    </Link>
  );

  return (
    <>
      <AdminPageHeader
        title='Properties'
        description={`${rows.length} ${rows.length === 1 ? 'listing' : 'listings'}, most recently updated first.`}
        actions={addButton}
      />
      {rows.length > 0 ? (
        <div className='overflow-hidden rounded-2xl border bg-card'>
          <PropertiesTable rows={rows} />
        </div>
      ) : (
        <AdminEmptyState
          title='No properties yet'
          body='Add your first listing. It stays a draft until you publish it.'
          action={addButton}
        />
      )}
    </>
  );
}
