import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { listAmenities } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Amenities' };

export default async function AdminAmenitiesPage() {
  await requireAdminPage('/admin/amenities');
  const amenities = await listAmenities();
  const groups = Map.groupBy(amenities, (a) => a.group ?? 'Other');

  return (
    <>
      <AdminPageHeader
        title='Amenities'
        description='Features you can tick on a listing, grouped the way buyers scan for them.'
      />
      {amenities.length === 0 ? (
        <AdminEmptyState title='No amenities yet' body='Add features like "24/7 power" or "Gated estate" to tick on listings.' />
      ) : (
        <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-3'>
          {[...groups].map(([group, items]) => (
            <section key={group} className='rounded-2xl border bg-card p-5'>
              <h2 className='font-heading text-base font-bold'>{group}</h2>
              <ul className='mt-3 divide-y'>
                {items.map((a) => (
                  <li key={a.id} className='flex items-center justify-between gap-3 py-2.5 text-sm'>
                    <span>{a.name}</span>
                    <span className='text-muted-foreground tabular-nums'>
                      {a._count.properties} {a._count.properties === 1 ? 'listing' : 'listings'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
