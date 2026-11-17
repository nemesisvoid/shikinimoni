import Link from 'next/link';
import { NotFoundIllustration } from '@/components/errors/not-found-illustration';
import { buttonVariants } from '@/components/ui/button';
import { LISTINGS_PATH } from '@/lib/listings/search';

/** A property link that no longer works: unpublished, sold and removed, or mistyped. */
export default function PropertyNotFound() {
  return (
    <section className='mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28'>
      <NotFoundIllustration className='w-56' />
      <h1 className='mt-10 text-h1 text-ink-950'>This property isn&apos;t listed any more.</h1>
      <p className='mt-4 max-w-xl text-lead text-muted-foreground'>
        It may have been sold, let or taken down by the owner, or the link has a typo. Plenty of others are still available.
      </p>
      <div className='mt-8 flex flex-wrap justify-center gap-2'>
        <Link
          href={LISTINGS_PATH}
          className={buttonVariants({ size: 'lg' })}>
          Browse properties
        </Link>
        <Link
          href='/contact?topic=buying'
          className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Ask us about it
        </Link>
      </div>
    </section>
  );
}
