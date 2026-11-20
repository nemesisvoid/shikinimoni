import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { homeForCurrentUser } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

/** After signing in: admins go to the admin, agents to their dashboard, everyone else home. */
export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <RedirectHome />
    </Suspense>
  );
}

async function RedirectHome(): Promise<null> {
  const home = await homeForCurrentUser();
  redirect(home ?? '/auth/sign-in?redirectTo=/account');
}
