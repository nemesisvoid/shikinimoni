import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import Link from 'next/link';
import { InquiriesTable } from '@/components/admin/inquiries-list';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { INQUIRY_VIEWS, inquiryViewHref, parseInquiryView, type InquiryView } from '@/lib/admin/inquiry-views';
import { countInquiriesByStatus, listInquiries } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Enquiries' };

const EMPTY: Record<InquiryView, { title: string; body: string }> = {
  open: { title: 'Nothing open', body: 'Every enquiry has been handled. New ones from the site appear here.' },
  new: { title: 'No new enquiries', body: 'New messages from the site appear here until someone picks them up.' },
  in_progress: { title: 'Nothing in progress', body: 'Enquiries you’re replying to or arranging viewings for appear here.' },
  closed: { title: 'Nothing closed yet', body: 'Enquiries you mark as closed move here.' },
  spam: { title: 'No spam', body: 'Enquiries marked as spam move here, out of the open list.' },
  all: { title: 'No enquiries yet', body: 'When visitors ask about a listing or request a viewing, their messages appear here.' },
};

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function AdminInquiriesPage(props: PageProps<'/admin/inquiries'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminInquiriesPageContent {...props} />
    </Suspense>
  );
}

async function AdminInquiriesPageContent({ searchParams }: PageProps<'/admin/inquiries'>) {
  await requireAdminPage('/admin/inquiries');
  const view = parseInquiryView((await searchParams).view);
  const [rows, counts] = await Promise.all([listInquiries(view), countInquiriesByStatus()]);

  const countFor = (v: InquiryView) => {
    const statuses = INQUIRY_VIEWS[v].statuses;
    return statuses ? statuses.reduce((sum, s) => sum + counts[s], 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  };

  return (
    <>
      <AdminPageHeader
        title='Enquiries'
        description={`${countFor('open')} open. Newest first. Open one to reply, add notes or change its status.`}
      />

      <nav
        aria-label='Filter enquiries'
        className='-mx-1 overflow-x-auto px-1'>
        <ul className='flex w-max gap-1 rounded-2xl bg-muted p-1'>
          {(Object.keys(INQUIRY_VIEWS) as InquiryView[]).map(v => {
            const current = v === view;
            return (
              <li key={v}>
                <Link
                  href={inquiryViewHref(v)}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    current ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}>
                  {INQUIRY_VIEWS[v].label}
                  <span className='text-xs text-muted-foreground tabular-nums'>{countFor(v)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length > 0 ? (
        <div className='overflow-x-auto rounded-2xl border bg-card'>
          <InquiriesTable rows={rows} />
        </div>
      ) : (
        <AdminEmptyState {...EMPTY[view]} />
      )}
    </>
  );
}
