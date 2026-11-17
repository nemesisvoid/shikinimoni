'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

/** An admin page failed. The sidebar stays, so the rest of the admin still works. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className='flex flex-1 items-center justify-center py-12'>
      <div className='flex max-w-md flex-col items-center text-center'>
        <title>Something went wrong | ShikiniMoni admin</title>
        <span className='grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive'>
          <TriangleAlert
            aria-hidden
            className='size-6'
          />
        </span>
        <h1 className='mt-5 text-h2'>This page didn&apos;t load.</h1>
        <p className='mt-2 text-muted-foreground'>
          Nothing you saved is lost. It&apos;s often the connection or a database hiccup, so try again.
        </p>
        <div className='mt-6 flex flex-wrap justify-center gap-2'>
          <Button onClick={() => retry()}>
            <RotateCw aria-hidden />
            Try again
          </Button>
          <Link
            href='/admin/dashboard'
            className={buttonVariants({ variant: 'outline' })}>
            Back to the dashboard
          </Link>
        </div>
        {digest && (
          <p className='mt-6 text-xs text-muted-foreground'>
            Error reference <span className='font-medium text-foreground tabular-nums'>{digest}</span>. It matches the
            entry in the server logs.
          </p>
        )}
      </div>
    </div>
  );
}
