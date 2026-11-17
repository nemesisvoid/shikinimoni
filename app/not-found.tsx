import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Search } from 'lucide-react';
import { NotFoundIllustration } from '@/components/errors/not-found-illustration';
import { SiteFooter } from '@/components/landing/site-footer';
import { SiteHeader } from '@/components/landing/site-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { LISTINGS_PATH } from '@/lib/listings/search';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'That page doesn’t exist. Search properties or go back to the home page.',
};

/**
 * Any URL that matches no route, and notFound() outside the property pages.
 * It renders in the root layout (outside the site's), so it brings its own header and footer.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className='flex flex-1 items-center'>
        <section className='mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28'>
          <NotFoundIllustration className='w-56 sm:w-64' />
          <h1 className='mt-10 text-h1 text-ink-950'>There&apos;s no page at this address.</h1>
          <p className='mt-4 max-w-xl text-lead text-muted-foreground'>
            The link may be old or mistyped. Search for a property instead, or start again from the home page.
          </p>

          <form
            action={LISTINGS_PATH}
            method='get'
            role='search'
            aria-label='Search properties'
            className='mt-8 flex w-full max-w-lg flex-col gap-2 rounded-[1.75rem] border bg-card p-2 shadow-card sm:flex-row'>
            <label className='relative flex-1'>
              <span className='sr-only'>Area, city or reference</span>
              <MapPin
                aria-hidden
                className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground'
              />
              <input
                name='q'
                type='search'
                placeholder='Area or city, e.g. Lekki'
                autoComplete='off'
                className='h-12 w-full rounded-full border border-input bg-background pr-4 pl-11 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25'
              />
            </label>
            <Button
              type='submit'
              size='lg'
              className='h-12 px-6 text-base'>
              <Search aria-hidden />
              Search
            </Button>
          </form>

          <div className='mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium'>
            <Link
              href='/'
              className={buttonVariants({ variant: 'link', className: 'px-0' })}>
              Home page
            </Link>
            <Link
              href={LISTINGS_PATH}
              className={buttonVariants({ variant: 'link', className: 'px-0' })}>
              All properties
            </Link>
            <Link
              href='/contact'
              className={buttonVariants({ variant: 'link', className: 'px-0' })}>
              Contact us
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
