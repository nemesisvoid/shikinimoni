import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AvailabilityBreakdown } from '@/components/admin/availability-breakdown';
import { InquiriesList } from '@/components/admin/inquiries-list';
import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { PropertiesTable } from '@/components/admin/properties-table';
import { StatStrip } from '@/components/admin/stat-strip';
import { buttonVariants } from '@/components/ui/button';
import { getDashboardData } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Dashboard' };

const viewAll = (href: string, label: string) => (
  <Link href={href} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'shrink-0 text-primary' })}>
    {label}
  </Link>
);

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage('/admin/dashboard');
  const data = await getDashboardData();
  const firstName = admin.name?.trim().split(/\s+/)[0];

  return (
    <>
      <AdminPageHeader
        title='Dashboard'
        description={`Welcome back${firstName ? `, ${firstName}` : ''}. Here's how your listings and enquiries stand today.`}
        actions={
          <Link href='/admin/properties/new' className={buttonVariants({ size: 'lg' })}>
            <Plus aria-hidden />
            Add property
          </Link>
        }
      />

      <StatStrip
        stats={[
          {
            label: 'Published listings',
            value: data.published,
            context: `${data.featured} featured on the home page`,
            href: '/admin/properties',
          },
          {
            label: 'Drafts',
            value: data.drafts,
            context: data.drafts > 0 ? 'Not visible on the site yet' : 'Nothing waiting to publish',
            href: '/admin/properties',
          },
          {
            label: 'New enquiries',
            value: data.newInquiries,
            context: `${data.inProgressInquiries} in progress`,
            href: '/admin/inquiries',
            needsAttention: true,
          },
          {
            label: 'Sold or rented',
            value: data.closedDeals,
            context: `${data.underOffer} under offer`,
          },
        ]}
      />

      {/* minmax(0,1fr) lets the column shrink below the table's width so the table scrolls inside its panel. */}
      <div className='grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]'>
        <AdminPanel
          title='Recently updated'
          description='The last listings you or your team changed'
          action={viewAll('/admin/properties', 'All properties')}
        >
          {data.recentListings.length > 0 ? (
            <div className='border-t'>
              <PropertiesTable rows={data.recentListings} compact />
            </div>
          ) : (
            <p className='px-5 pb-5 text-sm text-muted-foreground'>No listings yet. Add your first property to see it here.</p>
          )}
        </AdminPanel>

        <div className='flex flex-col gap-6'>
          <AdminPanel title='Published by availability' description='How your live stock is moving'>
            <AvailabilityBreakdown counts={data.availabilityCounts} />
          </AdminPanel>
          <AdminPanel title='Open enquiries' action={viewAll('/admin/inquiries', 'All enquiries')}>
            <InquiriesList rows={data.recentInquiries} />
          </AdminPanel>
        </div>
      </div>
    </>
  );
}
