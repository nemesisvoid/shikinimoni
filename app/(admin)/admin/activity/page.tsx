import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ActivityWhoFilter } from '@/components/admin/activity-who-filter';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import {
  ACTIVITY_AREAS,
  activityHref,
  getActivity,
  getPropertyName,
  listActivityActors,
  parseActivityFilters,
  type ActivityArea,
  type ActivityEntry,
} from '@/lib/admin/activity';
import { requireAdminPage } from '@/lib/auth/guards';
import { initialsFor } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Activity log' };

const LAGOS = 'Africa/Lagos';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS });
const dayHeading = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: LAGOS });
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAGOS });
const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: LAGOS });

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function ActivityPage(props: PageProps<'/admin/activity'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ActivityPageContent {...props} />
    </Suspense>
  );
}

async function ActivityPageContent({ searchParams }: PageProps<'/admin/activity'>) {
  await requireAdminPage('/admin/activity');
  const filters = parseActivityFilters(await searchParams);
  const [{ entries, total, page, pageCount }, actors, propertyName] = await Promise.all([
    getActivity(filters),
    listActivityActors(),
    filters.property ? getPropertyName(filters.property) : null,
  ]);

  const whoHrefs = Object.fromEntries([
    ['anyone', activityHref({ ...filters, who: undefined, page: 1 })],
    ...actors.map(a => [a.id, activityHref({ ...filters, who: a.id, page: 1 })]),
  ]);
  const filtered = filters.area !== 'all' || !!filters.who || !!filters.property;

  return (
    <>
      <AdminPageHeader
        title='Activity log'
        description='Every change made in the admin: who made it, what changed and when (Lagos time).'
      />

      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        {filters.property ? (
          <p className='flex flex-wrap items-center gap-2 text-sm'>
            <span className='text-muted-foreground'>Showing changes to</span>
            <span className='inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 font-medium'>
              {propertyName ?? 'this listing'}
              <Link
                href={activityHref({ who: filters.who })}
                aria-label='Show all activity'
                className='rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground'>
                <X
                  aria-hidden
                  className='size-3.5'
                />
              </Link>
            </span>
          </p>
        ) : (
          <nav
            aria-label='What changed'
            className='-mx-1 overflow-x-auto px-1'>
            <ul className='flex w-max gap-1 rounded-2xl bg-muted p-1'>
              {(Object.keys(ACTIVITY_AREAS) as ActivityArea[]).map(a => (
                <li key={a}>
                  <Link
                    href={activityHref({ area: a, who: filters.who })}
                    aria-current={a === filters.area ? 'page' : undefined}
                    className={cn(
                      'block rounded-xl px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                      a === filters.area ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}>
                    {ACTIVITY_AREAS[a].label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {actors.length > 1 && (
          <ActivityWhoFilter
            actors={actors}
            value={filters.who}
            hrefFor={whoHrefs}
          />
        )}
      </div>

      {entries.length === 0 ? (
        <AdminEmptyState
          title={filtered ? 'Nothing matches' : 'No activity yet'}
          body={
            filtered
              ? 'No changes match these filters. Try another area or person.'
              : 'Changes to listings, enquiries, amenities, the team and site settings appear here as they happen.'
          }
          action={
            filtered ? (
              <Link
                href='/admin/activity'
                className={buttonVariants({ variant: 'outline' })}>
                Show all activity
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className='flex flex-col gap-6'>
            {groupByDay(entries).map(group => (
              <section
                key={group.key}
                aria-labelledby={`day-${group.key}`}
                className='rounded-2xl border bg-card'>
                <h2
                  id={`day-${group.key}`}
                  className='border-b px-5 py-3 font-heading text-sm font-bold tracking-tight'>
                  {group.heading}
                </h2>
                <ol className='divide-y'>
                  {group.entries.map(entry => (
                    <ActivityRow
                      key={entry.id}
                      entry={entry}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label='Pages'
              className='flex items-center justify-between gap-3 text-sm'>
              <span className='text-muted-foreground tabular-nums'>
                Page {page} of {pageCount} · {total.toLocaleString('en-NG')} changes
              </span>
              <span className='flex gap-2'>
                {page > 1 && (
                  <Link
                    href={activityHref({ ...filters, page: page - 1 })}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <ChevronLeft aria-hidden />
                    Newer
                  </Link>
                )}
                {page < pageCount && (
                  <Link
                    href={activityHref({ ...filters, page: page + 1 })}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Older
                    <ChevronRight aria-hidden />
                  </Link>
                )}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function groupByDay(entries: ActivityEntry[]) {
  const today = dayKey.format(new Date());
  const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
  const groups: { key: string; heading: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey.format(entry.at);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = { key, heading: key === today ? 'Today' : key === yesterday ? 'Yesterday' : dayHeading.format(entry.at), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const actor = entry.actor;
  const actorName = actor ? actor.name || actor.email : 'Someone (account since removed)';
  const changed = entry.details.map(d => d.label.toLowerCase());
  const summary = changed.length <= 3 ? joinWords(changed) : `${changed.slice(0, 2).join(', ')} and ${changed.length - 2} more`;

  return (
    <li className='flex gap-3 px-5 py-4'>
      <Avatar className='mt-0.5 size-8 rounded-lg'>
        {actor?.image && (
          <AvatarImage
            src={actor.image}
            alt=''
          />
        )}
        <AvatarFallback className='rounded-lg bg-plum-100 text-[11px] font-semibold text-plum-900'>
          {actor ? initialsFor(actor.name, actor.email) : '?'}
        </AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-col gap-x-4 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between'>
          <p className='text-sm text-pretty'>
            <span className='font-semibold'>{actorName}</span> {entry.before}
            {entry.target && (
              <>
                {' '}
                {entry.target.href ? (
                  <Link
                    href={entry.target.href}
                    className='font-medium underline decoration-border underline-offset-4 hover:decoration-foreground'>
                    {entry.target.label}
                  </Link>
                ) : (
                  <span className='font-medium'>{entry.target.label}</span>
                )}
              </>
            )}
            {entry.after && ` ${entry.after}`}
          </p>
          <time
            dateTime={entry.at.toISOString()}
            title={stamp.format(entry.at)}
            className='shrink-0 text-xs text-muted-foreground tabular-nums'>
            {clock.format(entry.at)}
          </time>
        </div>

        {entry.details.length > 0 && (
          <details className='group mt-1.5 text-sm'>
            <summary className='cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden'>
              <span className='underline decoration-dotted underline-offset-4'>Changed {summary}</span>
              <span className='ml-1 inline-block transition-transform group-open:rotate-90'>›</span>
            </summary>
            <dl className='mt-2 grid gap-x-4 gap-y-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)]'>
              {entry.details.map(d => (
                <div
                  key={d.label}
                  className='contents'>
                  <dt className='text-muted-foreground'>{d.label}</dt>
                  <dd className='min-w-0 break-words'>
                    {d.note ? (
                      d.note.charAt(0).toUpperCase() + d.note.slice(1)
                    ) : (
                      <>
                        <span className='text-muted-foreground line-through decoration-muted-foreground/50'>{d.from}</span>
                        <span
                          aria-hidden
                          className='mx-1.5 text-muted-foreground'>
                          →
                        </span>
                        <span className='sr-only'>changed to </span>
                        <span className='font-medium'>{d.to}</span>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}

function joinWords(words: string[]) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
