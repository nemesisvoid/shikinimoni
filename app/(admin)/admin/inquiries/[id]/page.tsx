import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react';
import { InquiryStatusBadge, ListingStatusBadge } from '@/components/admin/badges';
import { InquiryHandlingForm } from '@/components/admin/inquiry-handling-form';
import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { buttonVariants } from '@/components/ui/button';
import { INQUIRY_TYPE_LABEL } from '@/lib/admin/meta';
import { getInquiry } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatRelativeTime } from '@/lib/format';
import { locationLine } from '@/lib/listings/format';
import { formatRef, propertyPath } from '@/lib/listings/search';
import { siteConfig, whatsappNumber } from '@/lib/site';
import { uuid } from '@/schemas/fields';

export const metadata = { title: 'Enquiry' };

const lagosStamp = new Intl.DateTimeFormat('en-NG', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  hourCycle: 'h12',
  minute: '2-digit',
  timeZone: 'Africa/Lagos',
});
const lagosDay = new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });

/** One enquiry: what they asked, how to reach them, and the team's handling panel.
 * The session check and data load stream into the skeleton, so navigating here is instant.
 */
export default function InquiryPage(props: PageProps<'/admin/inquiries/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <InquiryPageContent {...props} />
    </Suspense>
  );
}

async function InquiryPageContent({ params }: PageProps<'/admin/inquiries/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/admin/inquiries/${id}`);
  if (!uuid().safeParse(id).success) notFound();

  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();
  const { property } = inquiry;

  const firstName = inquiry.name.split(/\s+/)[0];
  const subject = property ? `Your enquiry about ${property.name} (${formatRef(property.refNumber)})` : `Your message to ${siteConfig.name}`;
  const mailto = `mailto:${inquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${firstName},\n\n`)}`;
  const isLive = property?.status === 'PUBLISHED' && property.deletedAt === null;

  return (
    <>
      <AdminPageHeader
        title={inquiry.name}
        description={
          <span className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <InquiryStatusBadge status={inquiry.status} />
            <span>{property ? INQUIRY_TYPE_LABEL[inquiry.type] : 'Contact page message'}</span>
            <span>
              Received <time dateTime={inquiry.createdAt.toISOString()}>{formatRelativeTime(inquiry.createdAt)}</time>
            </span>
          </span>
        }
        actions={
          <>
            <Link
              href='/admin/inquiries'
              className={buttonVariants({ variant: 'ghost' })}>
              <ArrowLeft aria-hidden />
              All enquiries
            </Link>
            <a
              href={mailto}
              className={buttonVariants()}>
              <Mail aria-hidden />
              Reply by email
            </a>
          </>
        }
      />

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <div className='flex min-w-0 flex-col gap-6'>
          <AdminPanel title='Message'>
            <div className='flex flex-col gap-4 px-5 pb-5'>
              {inquiry.preferredViewingAt && (
                <p className='rounded-xl bg-azure-50 px-3 py-2 text-sm text-azure-900'>
                  Would like to inspect on <strong className='font-semibold'>{lagosDay.format(inquiry.preferredViewingAt)}</strong>
                </p>
              )}
              <p className='text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap text-ink-800'>{inquiry.message}</p>
              <p className='text-xs text-muted-foreground'>Sent {lagosStamp.format(inquiry.createdAt)} (Lagos time)</p>
            </div>
          </AdminPanel>

          <AdminPanel title='Contact'>
            <dl className='divide-y border-t text-sm'>
              <Detail label='Email'>
                <a
                  href={mailto}
                  className='font-medium break-all text-primary underline-offset-4 hover:underline'>
                  {inquiry.email}
                </a>
              </Detail>
              <Detail label='Phone'>
                {inquiry.phone ? (
                  <span className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                    <a
                      href={`tel:+${whatsappNumber(inquiry.phone)}`}
                      className='inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline'>
                      <Phone
                        aria-hidden
                        className='size-3.5'
                      />
                      {inquiry.phone}
                    </a>
                    <a
                      href={`https://wa.me/${whatsappNumber(inquiry.phone)}?text=${encodeURIComponent(`Hi ${firstName}, this is ${siteConfig.name}.`)}`}
                      target='_blank'
                      rel='noopener'
                      className='inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline'>
                      <MessageCircle
                        aria-hidden
                        className='size-3.5'
                      />
                      WhatsApp
                    </a>
                  </span>
                ) : (
                  <span className='text-muted-foreground'>Not given</span>
                )}
              </Detail>
              <Detail label='Account'>
                {inquiry.userId ? 'Signed in when they sent it' : <span className='text-muted-foreground'>Sent without an account</span>}
              </Detail>
            </dl>
          </AdminPanel>

          <AdminPanel title='About'>
            {property ? (
              <div className='flex flex-col gap-3 px-5 pb-5'>
                <div>
                  <p className='font-medium'>{property.name}</p>
                  <p className='text-sm text-muted-foreground'>
                    {formatRef(property.refNumber)} · {locationLine(property)}
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  {property.deletedAt ? (
                    <span className='text-sm text-muted-foreground'>This listing has been deleted.</span>
                  ) : (
                    <>
                      <ListingStatusBadge status={property.status} />
                      <Link
                        href={`/admin/properties/${property.id}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        Open listing
                      </Link>
                      {isLive && (
                        <a
                          href={propertyPath(property.slug)}
                          target='_blank'
                          rel='noopener'
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                          View on site
                          <ExternalLink aria-hidden />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className='px-5 pb-5 text-sm text-muted-foreground'>
                {inquiry.type === 'GENERAL' && !inquiry.preferredViewingAt
                  ? 'Sent from the contact page, not about a particular listing.'
                  : 'The listing it was about has since been removed.'}
              </p>
            )}
          </AdminPanel>
        </div>

        <AdminPanel
          title='Handling'
          className='lg:sticky lg:top-20'>
          <InquiryHandlingForm
            id={inquiry.id}
            status={inquiry.status}
            notes={inquiry.adminNotes}
          />
          <dl className='divide-y border-t text-sm'>
            <Detail label='First response'>
              {inquiry.respondedAt ? lagosStamp.format(inquiry.respondedAt) : <span className='text-muted-foreground'>Not yet</span>}
            </Detail>
            <Detail label='Handled by'>
              {inquiry.assignedTo ? (
                inquiry.assignedTo.name || inquiry.assignedTo.email
              ) : (
                <span className='text-muted-foreground'>Nobody yet</span>
              )}
            </Detail>
          </dl>
        </AdminPanel>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid gap-1 px-5 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0'>{children}</dd>
    </div>
  );
}
