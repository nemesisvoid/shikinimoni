import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { buttonVariants } from '@/components/ui/button';
import { getSiteContact } from '@/lib/site-settings';
import { telHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Account paused', robots: { index: false, follow: false } };

/** Where a suspended agent lands. Their live listings stay up; only the agent area is closed. */
export default async function AccountPausedPage() {
  const contact = await getSiteContact();
  return (
    <main className='flex flex-1 flex-col items-center bg-ink-50 px-4 py-10 sm:py-16'>
      <Logo className='h-12' />
      <div className='mt-8 w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8'>
        <h1 className='font-heading text-2xl font-extrabold tracking-tight'>Your agent account is paused</h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          The ShikiniMoni team has paused your access to the agent area. Your live listings are still on the site. To find out more, contact
          the team.
        </p>
        <div className='mt-6 flex flex-col gap-2'>
          <a
            href={`mailto:${contact.contactEmail}`}
            className={buttonVariants({ size: 'lg' })}>
            Email {contact.contactEmail}
          </a>
          <a
            href={telHref(contact.phone)}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Call {contact.phone}
          </a>
          <Link
            href='/'
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
