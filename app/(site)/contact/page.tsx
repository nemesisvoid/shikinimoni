import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ContactChannels } from '@/components/contact/contact-channels';
import { ContactFaq } from '@/components/contact/contact-faq';
import { ContactForm } from '@/components/contact/contact-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/lib/auth/guards';
import { siteConfig } from '@/lib/site';
import { isContactTopic } from '@/schemas/inquiry.schema';

export const metadata: Metadata = {
  title: `Contact us | ${siteConfig.name}`,
  description: `Questions about a listing, an inspection or selling your property? Message, call or WhatsApp the ${siteConfig.name} team.`,
};

export default function ContactPage({ searchParams }: PageProps<'/contact'>) {
  return (
    <>
      <section className='mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-6 lg:px-8 lg:pt-20 lg:pb-14'>
        <h1 className='max-w-3xl text-display text-ink-950 motion-safe:animate-rise'>Talk to someone who knows the papers.</h1>
        <p className='mt-5 max-w-2xl text-lead text-muted-foreground motion-safe:animate-rise [animation-delay:120ms]'>
          Questions about a listing, an inspection, or selling your land or house? Send us a message and a real person replies{' '}
          {siteConfig.replyTime}.
        </p>
      </section>

      <div className='mx-auto grid max-w-7xl items-start gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8 lg:px-8'>
        <section
          aria-label='Send us a message'
          className='rounded-[2rem] border bg-card p-6 shadow-float sm:p-8 lg:p-10'>
          {/* Reads ?topic= and the session (to prefill), so it renders per request. */}
          <Suspense fallback={<ContactFormSkeleton />}>
            <PrefilledContactForm searchParams={searchParams} />
          </Suspense>
        </section>
        <div className='lg:sticky lg:top-24'>
          <ContactChannels />
        </div>
      </div>

      <ContactFaq />
    </>
  );
}

/**
 * "Talk to our team" on the landing page links to /contact?topic=selling.
 * Signed-in visitors get their name and email filled in.
 */
async function PrefilledContactForm({ searchParams }: { searchParams: PageProps<'/contact'>['searchParams'] }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser().catch(() => null)]);
  const topic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  return (
    <ContactForm
      defaults={{
        topic: isContactTopic(topic) ? topic : undefined,
        name: user?.name ?? undefined,
        email: user?.email ?? undefined,
      }}
    />
  );
}

function ContactFormSkeleton() {
  return (
    <div
      aria-hidden
      className='flex flex-col gap-7'>
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-4 w-32' />
        <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-4'>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={i}
              className='h-24 rounded-2xl'
            />
          ))}
        </div>
      </div>
      <div className='grid gap-5 sm:grid-cols-2'>
        <Skeleton className='h-12 rounded-3xl' />
        <Skeleton className='h-12 rounded-3xl' />
      </div>
      <Skeleton className='h-12 rounded-3xl sm:w-1/2' />
      <Skeleton className='h-40 rounded-2xl' />
      <Skeleton className='ml-auto h-12 w-40 rounded-full' />
    </div>
  );
}
