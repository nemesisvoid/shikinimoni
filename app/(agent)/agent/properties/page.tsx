import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AgentListingsList } from '@/components/agent/listings-list';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { buttonVariants } from '@/components/ui/button';
import { listAgentListings, needsAgentAttention, type AgentListingRow } from '@/lib/agents/queries';
import { requireAgentPage } from '@/lib/auth/guards';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Your listings' };

const VIEWS = {
  all: { label: 'All', match: () => true },
  attention: { label: 'Needs attention', match: (r: AgentListingRow) => needsAgentAttention(r.stage) },
  drafts: { label: 'Drafts', match: (r: AgentListingRow) => r.stage === 'draft' },
  review: { label: 'In review', match: (r: AgentListingRow) => r.stage === 'pending' || r.stage === 'live-changes-pending' },
  live: { label: 'Live', match: (r: AgentListingRow) => r.stage.startsWith('live') },
  closed: { label: 'Not live', match: (r: AgentListingRow) => r.stage === 'rejected' || r.stage === 'archived' },
} as const;
type View = keyof typeof VIEWS;

const addButton = (
  <Link
    href='/agent/properties/new'
    className={buttonVariants({ size: 'lg' })}>
    <Plus aria-hidden />
    Add property
  </Link>
);

export default function AgentListingsPage(props: PageProps<'/agent/properties'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AgentListings {...props} />
    </Suspense>
  );
}

async function AgentListings({ searchParams }: PageProps<'/agent/properties'>) {
  const { user } = await requireAgentPage('/agent/properties');
  const [{ view: rawView }, rows] = await Promise.all([searchParams, listAgentListings(user.id)]);
  const view: View = typeof rawView === 'string' && rawView in VIEWS ? (rawView as View) : 'all';
  const shown = rows.filter(VIEWS[view].match);

  if (rows.length === 0) {
    return (
      <>
        <AdminPageHeader
          title='Your listings'
          actions={addButton}
        />
        <AdminEmptyState
          title='No listings yet'
          body='Add a property with its photos, price and location. Save it as a draft while you work, then submit it for review.'
          action={addButton}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title='Your listings'
        description='Only you and the ShikiniMoni team see drafts. Live listings show their views over the last 30 days.'
        actions={addButton}
      />
      <nav
        aria-label='Filter listings'
        className='-mx-1 overflow-x-auto px-1'>
        <ul className='flex w-max gap-1 rounded-2xl bg-muted p-1'>
          {(Object.keys(VIEWS) as View[]).map(v => {
            const count = rows.filter(VIEWS[v].match).length;
            return (
              <li key={v}>
                <Link
                  href={v === 'all' ? '/agent/properties' : `/agent/properties?view=${v}`}
                  aria-current={v === view ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    v === view ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}>
                  {VIEWS[v].label}
                  <span className='text-xs text-muted-foreground tabular-nums'>{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {shown.length > 0 ? (
        <div className='rounded-2xl border bg-card'>
          <AgentListingsList rows={shown} />
        </div>
      ) : (
        <AdminEmptyState
          title='Nothing here'
          body='No listings match this filter.'
        />
      )}
    </>
  );
}
