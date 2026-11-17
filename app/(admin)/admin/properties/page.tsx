import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { PropertiesDataTable } from '@/components/admin/properties-data-table';
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, type AdminPropertyRow, type PropertyTableQuery } from '@/lib/admin/property-table';
import { buttonVariants } from '@/components/ui/button';
import { listAdminPropertiesPage } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { PropertyFiltersSchema } from '@/schemas/property.schema';

export const metadata = { title: 'Properties' };

/**
 * Search, filters, sort and page all live in the URL, so the server only loads
 * the rows on screen and any view can be bookmarked or shared.
 * The session check and data load stream into the skeleton, so navigating here is instant.
 */
export default function AdminPropertiesPage(props: PageProps<'/admin/properties'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminPropertiesPageContent {...props} />
    </Suspense>
  );
}

async function AdminPropertiesPageContent({ searchParams }: PageProps<'/admin/properties'>) {
  await requireAdminPage('/admin/properties');
  const params = await searchParams;
  const parsed = PropertyFiltersSchema.parse(params);
  const filters = {
    ...parsed,
    // The public default is "newest"; admins see recently edited first.
    sort: params.sort ? parsed.sort : DEFAULT_SORT,
    pageSize: params.pageSize ? parsed.pageSize : DEFAULT_PAGE_SIZE,
  };

  const { rows, total, page } = await listAdminPropertiesPage(filters);
  const hasFilters = Boolean(filters.q || filters.status || filters.listingType || filters.category || filters.availability || filters.deleted);

  const addButton = (
    <Link
      href='/admin/properties/new'
      className={buttonVariants({ size: 'lg' })}>
      <Plus aria-hidden />
      Add property
    </Link>
  );

  if (total === 0 && !hasFilters) {
    return (
      <>
        <AdminPageHeader
          title='Properties'
          actions={addButton}
        />
        <AdminEmptyState
          title='No properties yet'
          body='Add your first listing. It stays a draft until you publish it.'
          action={addButton}
        />
      </>
    );
  }

  const query: PropertyTableQuery = {
    q: filters.q,
    status: filters.status,
    listingType: filters.listingType,
    category: filters.category,
    availability: filters.availability,
    deleted: filters.deleted || undefined,
    sort: filters.sort,
    page,
    pageSize: filters.pageSize,
  };

  // Plain values only: Decimal and Date can't be passed to a client component.
  const tableRows: AdminPropertyRow[] = rows.map(p => ({
    id: p.id,
    refNumber: p.refNumber,
    slug: p.slug,
    name: p.name,
    location: [p.neighborhood, p.city, p.state].filter(Boolean).join(', '),
    status: p.status,
    availability: p.availability,
    listingType: p.listingType,
    category: p.category,
    isFeatured: p.isFeatured,
    price: p.price === null ? null : p.price.toString(),
    currency: p.currency,
    pricePeriod: p.pricePeriod,
    updatedAt: p.updatedAt.toISOString(),
    coverUrl: p.media[0]?.url ?? null,
    deletedAt: p.deletedAt?.toISOString() ?? null,
  }));

  return (
    <>
      <AdminPageHeader
        title='Properties'
        description={
          filters.deleted
            ? 'Deleted properties are off the site. Restore one to edit it again, or remove it for good.'
            : 'Search, filter and sort your listings. Click a property to edit it.'
        }
        actions={addButton}
      />
      <PropertiesDataTable
        rows={tableRows}
        total={total}
        query={query}
      />
    </>
  );
}
