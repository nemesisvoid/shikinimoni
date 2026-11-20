import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { listPendingReview } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatRelativeTime, initialsFor } from '@/lib/format';

export const metadata = { title: 'Review' };

export default function AdminReviewPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminReview />
    </Suspense>
  );
}

async function AdminReview() {
  await requireAdminPage('/admin/review');
  const rows = await listPendingReview();

  return (
    <>
      <AdminPageHeader
        title='Review'
        description='Listings and changes agents have submitted, oldest first. Nothing here is on the site until you approve it.'
      />
      {rows.length === 0 ? (
        <AdminEmptyState
          title='Nothing to review'
          body='When an agent submits a new listing, or changes to a live one, it appears here.'
          action={
            <Link
              href='/admin/agents'
              className={buttonVariants({ variant: 'outline' })}>
              Manage agents
            </Link>
          }
        />
      ) : (
        <ul className='divide-y rounded-2xl border bg-card'>
          {rows.map(row => {
            const agent = row.agent;
            const agentName = agent?.user.name || agent?.user.email || 'A former agent';
            const place = [row.neighborhood, row.city].filter(Boolean).join(', ');
            const isNew = row.status === 'PENDING_REVIEW';
            return (
              <li
                key={row.id}
                className='flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center'>
                <div className='flex min-w-0 flex-1 items-center gap-3'>
                  <div className='relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted'>
                    {row.media[0] ? (
                      <Image
                        src={row.media[0].url}
                        alt=''
                        fill
                        sizes='56px'
                        className='object-cover'
                      />
                    ) : (
                      <Building2
                        aria-hidden
                        className='absolute inset-0 m-auto size-5 text-muted-foreground'
                      />
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='flex flex-wrap items-center gap-2'>
                      <span className='truncate font-medium'>{row.name}</span>
                      <span
                        className={
                          isNew
                            ? 'rounded-full bg-sunset-100 px-2.5 py-0.5 text-xs font-medium text-sunset-900 ring-1 ring-sunset-200 ring-inset'
                            : 'rounded-full bg-azure-50 px-2.5 py-0.5 text-xs font-medium text-azure-800 ring-1 ring-azure-200 ring-inset'
                        }>
                        {isNew ? 'New listing' : 'Changes to a live listing'}
                      </span>
                    </p>
                    <p className='mt-1 flex items-center gap-2 truncate text-sm text-muted-foreground'>
                      <Avatar className='size-5 rounded-md'>
                        {agent?.photoUrl && (
                          <AvatarImage
                            src={agent.photoUrl}
                            alt=''
                          />
                        )}
                        <AvatarFallback className='rounded-md bg-plum-100 text-[9px] font-semibold text-plum-900'>
                          {initialsFor(agent?.user.name, agent?.user.email ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                      <span className='truncate'>
                        {agentName} · submitted {formatRelativeTime(row.submittedAt ?? new Date())}
                        {place && ` · ${place}`}
                      </span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/properties/${row.id}`}
                  className={buttonVariants({ className: 'shrink-0 self-end sm:self-auto' })}>
                  Review
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
