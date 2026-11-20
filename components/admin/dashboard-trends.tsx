import Link from 'next/link';
import { AdminPanel } from '@/components/admin/page-header';
import { TrendBars } from '@/components/admin/trend-bars';
import { INQUIRY_TYPE_LABEL } from '@/lib/admin/meta';
import { TREND_RANGES, type DashboardTrends, type TrendRange } from '@/lib/admin/trends';
import type { InquiryType } from '@/lib/generated/prisma/enums';
import { cn } from '@/lib/utils';

function change(now: number, before: number, period: string) {
  if (before === 0) return now === 0 ? `None in ${period} either` : `None in ${period}`;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `Same as ${period}`;
  return `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on ${period} (${before.toLocaleString('en-NG')})`;
}

/** Range switcher: links, so the choice is in the URL and survives a refresh. */
function RangeTabs({ current }: { current: TrendRange }) {
  return (
    <nav aria-label='Trend period'>
      <ul className='flex gap-1 rounded-xl bg-muted p-1'>
        {(Object.keys(TREND_RANGES) as TrendRange[]).map(r => (
          <li key={r}>
            <Link
              href={r === '30d' ? '/admin/dashboard' : `/admin/dashboard?range=${r}`}
              scroll={false}
              aria-current={r === current ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                r === current ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}>
              {TREND_RANGES[r].label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Figure({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div>
      <h3 className='text-sm font-medium text-muted-foreground'>{label}</h3>
      <p className='mt-1 font-heading text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums'>{value.toLocaleString('en-NG')}</p>
      <p className='mt-1.5 text-sm text-muted-foreground'>{note}</p>
    </div>
  );
}

export function DashboardTrends({ trends }: { trends: DashboardTrends }) {
  const { range, buckets, totals, enquiriesByType, countingSince, noViewsYet } = trends;
  const { tickEvery, previous, label } = TREND_RANGES[range];
  const types = (Object.keys(enquiriesByType) as InquiryType[]).filter(t => enquiriesByType[t] > 0);

  return (
    <AdminPanel
      title='Trends'
      description={`The last ${label}, in Lagos time. Spam isn’t counted.`}
      action={<RangeTabs current={range} />}>
      <div className='grid gap-x-10 gap-y-8 border-t px-5 py-5 lg:grid-cols-2'>
        <section className='flex flex-col gap-4'>
          <Figure
            label='Enquiries'
            value={totals.enquiries}
            note={change(totals.enquiries, totals.previousEnquiries, previous)}
          />
          <TrendBars
            points={buckets.map(b => ({ key: b.key, label: b.label, tick: b.tick, value: b.enquiries, partial: b.partial }))}
            color='var(--chart-1)'
            noun={['enquiry', 'enquiries']}
            tickEvery={tickEvery}
            caption={`Enquiries over the last ${label}`}
          />
          {types.length > 0 && (
            <ul className='flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground'>
              {types.map(t => (
                <li key={t}>
                  <span className='font-medium text-foreground tabular-nums'>{enquiriesByType[t]}</span> {INQUIRY_TYPE_LABEL[t].toLowerCase()}
                  {enquiriesByType[t] === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className='flex flex-col gap-4'>
          <Figure
            label='Listing views'
            value={totals.views}
            note={
              noViewsYet
                ? 'Counting starts with the next visit to a listing'
                : countingSince
                  ? `Counted since ${countingSince}`
                  : change(totals.views, totals.previousViews, previous)
            }
          />
          <TrendBars
            points={buckets.map(b => ({ key: b.key, label: b.label, tick: b.tick, value: b.views, partial: b.partial }))}
            color='var(--chart-4)'
            noun={['view', 'views']}
            tickEvery={tickEvery}
            caption={`Listing views over the last ${label}`}
          />
          <p className='text-sm text-muted-foreground'>One view per visitor per listing per day. Your team’s visits aren’t counted.</p>
        </section>
      </div>
    </AdminPanel>
  );
}

/** Most viewed listings in the period, with the enquiries each brought in. */
export function TopListings({ trends }: { trends: DashboardTrends }) {
  const rows = trends.topListings;
  const top = Math.max(1, ...rows.map(r => r.views));
  return (
    <AdminPanel
      title='Most viewed'
      description={`Listings visitors looked at most in the last ${TREND_RANGES[trends.range].label}`}>
      {rows.length === 0 ? (
        <p className='px-5 pb-5 text-sm text-muted-foreground'>No views in this period yet. Listings appear here once visitors open them.</p>
      ) : (
        <ol className='flex flex-col gap-4 px-5 pb-5'>
          {rows.map(r => {
            const place = [r.neighborhood, r.city].filter(Boolean).join(', ');
            const gone = r.deletedAt !== null || r.status !== 'PUBLISHED';
            return (
              <li key={r.id}>
                <div className='flex items-baseline justify-between gap-3 text-sm'>
                  <Link
                    href={`/admin/properties/${r.id}`}
                    className='min-w-0 truncate font-medium hover:underline'>
                    {r.name}
                  </Link>
                  <span className='shrink-0 tabular-nums'>
                    <span className='font-semibold'>{r.views.toLocaleString('en-NG')}</span>
                    <span className='text-muted-foreground'> {r.views === 1 ? 'view' : 'views'}</span>
                  </span>
                </div>
                <div
                  aria-hidden
                  className='mt-1.5 h-1.5 rounded-full bg-muted'>
                  <div
                    className='h-full rounded-full'
                    style={{ width: `${(r.views / top) * 100}%`, backgroundColor: 'var(--chart-4)' }}
                  />
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {r.enquiries === 0 ? 'No enquiries' : `${r.enquiries} ${r.enquiries === 1 ? 'enquiry' : 'enquiries'}`}
                  {place && ` · ${place}`}
                  {gone && (r.deletedAt ? ' · deleted' : ' · not on the site now')}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </AdminPanel>
  );
}
