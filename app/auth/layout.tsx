import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { homeForCurrentUser } from '@/lib/auth/guards';

// Account screens have nothing worth showing in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Sign-in and sign-up are for signed-out visitors only: anyone with a session
 * is sent to their own home (the admin, the agent area, or the site). The session check runs per request, so it streams
 * inside Suspense.
 */
export default function AuthLayout({ children }: LayoutProps<'/auth'>) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignedOutOnly>{children}</SignedOutOnly>
    </Suspense>
  );
}

async function SignedOutOnly({ children }: { children: React.ReactNode }) {
  const home = await homeForCurrentUser();
  if (home) redirect(home);
  return children;
}

function AuthFormSkeleton() {
  return (
    <div className='mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16'>
      <Skeleton className='h-8 w-40' />
      <Skeleton className='h-10 w-full' />
      <Skeleton className='h-10 w-full' />
      <Skeleton className='h-10 w-full' />
    </div>
  );
}
