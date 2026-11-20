import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JoinAccept, JoinSignOut, JoinSignUpForm } from '@/components/agent/join-forms';
import { Logo } from '@/components/brand/logo';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { findInvite } from '@/lib/agents/invites';
import { getCurrentUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'Join as an agent', robots: { index: false, follow: false } };

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });

/** The page an agent's invite link opens. Reads the session, so it renders per request. */
export default function JoinPage({ params }: PageProps<'/join/[token]'>) {
  return (
    <main className='flex flex-1 flex-col items-center bg-ink-50 px-4 py-10 sm:py-16'>
      <Logo className='h-12' />
      <div className='mt-8 w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8'>
        <Suspense fallback={<JoinSkeleton />}>
          <JoinContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function JoinContent({ params }: { params: PageProps<'/join/[token]'>['params'] }) {
  const { token } = await params;
  const [found, user] = await Promise.all([findInvite(token), getCurrentUser()]);

  if (found.state !== 'valid') {
    const copy = {
      used: { title: 'This invite has been used', body: 'If it was you, sign in to reach your agent dashboard.' },
      expired: { title: 'This invite has expired', body: 'Invite links last 7 days. Ask the ShikiniMoni team to send you a new one.' },
      cancelled: { title: 'This invite was cancelled', body: 'Ask the ShikiniMoni team to send you a new one.' },
      unknown: { title: 'This link doesn’t work', body: 'Check you copied the whole link, or ask the ShikiniMoni team for a new one.' },
    }[found.state];
    return (
      <Message
        title={copy.title}
        body={copy.body}>
        {found.state === 'used' && !user ? (
          <Link
            href='/auth/sign-in?redirectTo=/agent'
            className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            Sign in
          </Link>
        ) : (
          <Link
            href={user ? '/account' : '/'}
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}>
            {user ? 'Go to your account' : 'Go to the home page'}
          </Link>
        )}
      </Message>
    );
  }

  const { invite } = found;
  const first = invite.name.trim().split(/\s+/)[0];
  const intro = `You’ve been invited to add property listings to ShikiniMoni. Your listings go live once our team has reviewed them.`;

  if (user) {
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return (
        <Message
          title='This invite is for someone else'
          body={`It was sent to ${invite.email}, but you’re signed in as ${user.email}. Sign out, then open the link again.`}>
          <JoinSignOut />
        </Message>
      );
    }
    return (
      <Message
        title={`Welcome, ${first}`}
        body={intro}>
        <JoinAccept token={token} />
      </Message>
    );
  }

  const hasAccount = await prisma.user.count({ where: { email: { equals: invite.email, mode: 'insensitive' } } });
  if (hasAccount) {
    return (
      <Message
        title={`Welcome, ${first}`}
        body={`${intro} You already have an account with ${invite.email}, so sign in to accept.`}>
        <Link
          href={`/auth/sign-in?redirectTo=${encodeURIComponent(`/join/${token}`)}`}
          className={buttonVariants({ size: 'lg', className: 'w-full' })}>
          Sign in to accept
        </Link>
      </Message>
    );
  }

  return (
    <>
      <h1 className='font-heading text-2xl font-extrabold tracking-tight'>Create your agent account</h1>
      <p className='mt-2 text-sm text-muted-foreground'>
        {intro} This link works until {day.format(invite.expiresAt)}.
      </p>
      <JoinSignUpForm
        token={token}
        name={invite.name}
        email={invite.email}
      />
    </>
  );
}

function Message({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-heading text-2xl font-extrabold tracking-tight'>{title}</h1>
        <p className='mt-2 text-sm text-muted-foreground'>{body}</p>
      </div>
      {children}
    </div>
  );
}

function JoinSkeleton() {
  return (
    <div
      role='status'
      aria-label='Loading'
      className='flex flex-col gap-4'>
      <Skeleton className='h-8 w-3/4' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-10 w-full' />
      <Skeleton className='h-10 w-full' />
      <Skeleton className='h-11 w-full' />
    </div>
  );
}
