import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AgentListingsList } from '@/components/agent/listings-list';
import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { StatStrip } from '@/components/admin/stat-strip';
import { buttonVariants } from '@/components/ui/button';
import { getAgentOverview } from '@/lib/agents/queries';
import { requireAgentPage } from '@/lib/auth/guards';

export const metadata = { title: 'Dashboard' };

export default function AgentDashboardPage(props: PageProps<'/agent'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AgentDashboard {...props} />
    </Suspense>
  );
}

async function AgentDashboard({ searchParams }: PageProps<'/agent'>) {
  const { user, agent } = await requireAgentPage('/agent');
  const [{ welcome }, overview] = await Promise.all([searchParams, getAgentOverview(user.id)]);
  const firstName = user.name?.trim().split(/\s+/)[0];
  const recent = overview.listings.filter(l => !overview.attention.includes(l)).slice(0, 5);
  const profileIncomplete = !agent.photoUrl || !agent.phone;

  return (
    <>
      <AdminPageHeader
        title={welcome ? `Welcome to ShikiniMoni${firstName ? `, ${firstName}` : ''}` : 'Dashboard'}
        description={
          welcome
            ? 'Add your first property. The team checks every listing before it goes live, and you’ll get an email when they do.'
            : `Hello${firstName ? `, ${firstName}` : ''}. Here’s where your listings stand.`
        }
        actions={
          <Link
            href='/agent/properties/new'
            className={buttonVariants({ size: 'lg' })}>
            <Plus aria-hidden />
            Add property
          </Link>
        }
      />

      {profileIncomplete && (
        <div className='flex flex-col gap-3 rounded-2xl border border-azure-200 bg-azure-50 p-4 text-sm text-azure-900 sm:flex-row sm:items-center sm:justify-between'>
          <p>
            {!agent.photoUrl && !agent.phone
              ? 'Add a photo and a phone number. The team uses your number to reach you, and your photo can show beside your listings.'
              : !agent.photoUrl
                ? 'Add a photo. It can show beside your listings.'
                : 'Add a phone number so the team can reach you quickly.'}
          </p>
          <Link
            href='/agent/profile'
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0 bg-background' })}>
            Complete your profile
          </Link>
        </div>
      )}

      <StatStrip
        stats={[
          { label: 'Live', value: overview.live, context: 'On the site now', href: '/agent/properties' },
          { label: 'Waiting for review', value: overview.pending, context: 'New listings and changes', href: '/agent/properties' },
          {
            label: 'Need your attention',
            value: overview.attention.length,
            context: overview.attention.length ? 'Sent back with a note' : 'Nothing sent back',
            href: '/agent/properties',
            needsAttention: true,
          },
          { label: 'Views', value: overview.views30, context: 'Your live listings, last 30 days' },
        ]}
      />

      {overview.attention.length > 0 && (
        <AdminPanel
          title='Needs your attention'
          description='The team sent these back. Make the changes in the note, then submit again.'>
          <div className='border-t'>
            <AgentListingsList rows={overview.attention} />
          </div>
        </AdminPanel>
      )}

      <AdminPanel
        title='Recently updated'
        description='Your latest listings'
        action={
          <Link
            href='/agent/properties'
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'shrink-0 text-primary' })}>
            All listings
          </Link>
        }>
        {recent.length > 0 ? (
          <div className='border-t'>
            <AgentListingsList
              rows={recent}
              showNote={false}
            />
          </div>
        ) : (
          <p className='px-5 pb-5 text-sm text-muted-foreground'>
            {overview.listings.length === 0 ? 'No listings yet. Add your first property to get started.' : 'Everything is listed above.'}
          </p>
        )}
      </AdminPanel>
    </>
  );
}
