'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { NotFoundIllustration } from '@/components/errors/not-found-illustration';
import { Button, buttonVariants } from '@/components/ui/button';
import { siteConfig } from '@/lib/site';

/**
 * A public page failed to render. The header and footer stay (they come from
 * the layout above this boundary), so people can still get around.
 */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className='mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28'>
      <title>{`Something went wrong | ${siteConfig.name}`}</title>
      <NotFoundIllustration
        label='!'
        className='w-48'
      />
      <h1 className='mt-10 text-h1 text-ink-950'>This page didn&apos;t load.</h1>
      <p className='mt-4 max-w-xl text-lead text-muted-foreground'>
        Something went wrong on our side. It&apos;s usually brief, so try again in a moment.
      </p>
      <div className='mt-8 flex flex-wrap justify-center gap-2'>
        <Button
          size='lg'
          onClick={() => retry()}>
          <RotateCw aria-hidden />
          Try again
        </Button>
        <Link
          href='/'
          className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Go to the home page
        </Link>
      </div>
      <p className='mt-10 text-sm text-muted-foreground'>
        Still not working?{' '}
        <Link
          href='/contact'
          className='font-medium text-primary underline-offset-4 hover:underline'>
          Tell us
        </Link>
        {digest && (
          <>
            {' '}
            and mention error <span className='font-medium text-foreground tabular-nums'>{digest}</span>
          </>
        )}
        .
      </p>
    </section>
  );
}
