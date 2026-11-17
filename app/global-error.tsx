'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Last resort: the root layout itself failed, so this replaces the whole
 * document. Kept to plain markup and the global stylesheet; no fonts or
 * components that could fail the same way.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang='en'>
      <body className='flex min-h-svh items-center justify-center bg-background px-4 font-sans text-foreground antialiased'>
        <title>Something went wrong | ShikiniMoni</title>
        <main className='flex max-w-md flex-col items-center text-center'>
          <p className='text-h3 text-plum-800'>ShikiniMoni</p>
          <h1 className='mt-6 text-h2'>The site didn&apos;t load.</h1>
          <p className='mt-3 text-muted-foreground'>Something went wrong on our side. Try again in a moment.</p>
          <div className='mt-8 flex flex-wrap justify-center gap-3'>
            <button
              type='button'
              onClick={() => retry()}
              className='h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground hover:bg-primary/85'>
              Try again
            </button>
            {/* A full page load on purpose, in case client navigation is what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href='/'
              className='inline-flex h-11 items-center rounded-full border px-6 font-medium hover:bg-muted'>
              Home page
            </a>
          </div>
          {digest && <p className='mt-8 text-xs text-muted-foreground'>Error reference {digest}</p>}
        </main>
      </body>
    </html>
  );
}
