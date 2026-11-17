import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PropertyCard } from '@/components/listing/property-card';
import { buttonVariants } from '@/components/ui/button';
import { getLatestListings } from '@/lib/listings/queries';
import { LISTINGS_PATH } from '@/lib/listings/search';

/** The landing page's newest published listings. Search and filters live on /properties. */
export async function Listings() {
  const { listings, total } = await getLatestListings(6);
  const showFeatured = listings.length >= 3 && listings[0].isFeatured;

  return (
    <ListingsShell>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h2 className='text-h1'>Latest listings</h2>
          <p className='mt-2 text-muted-foreground'>
            {total > 0
              ? `${total} ${total === 1 ? 'property' : 'properties'} listed, each with its title shown up front.`
              : 'New listings are on the way.'}
          </p>
        </div>
        {total > 0 && (
          <Link
            href={LISTINGS_PATH}
            className={buttonVariants({ variant: 'outline' })}>
            Browse all properties
            <ArrowRight aria-hidden />
          </Link>
        )}
      </div>

      {listings.length > 0 ? (
        <ul className='mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {listings.map((p, i) => {
            const featured = showFeatured && i === 0;
            return (
              <li
                key={p.id}
                className={featured ? 'md:col-span-2 lg:row-span-2' : undefined}>
                <PropertyCard
                  property={p}
                  featured={featured}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className='mt-10 rounded-2xl border border-dashed p-10 text-center'>
          <p className='font-heading text-h3'>No properties are listed right now.</p>
          <p className='mt-2 text-muted-foreground'>Tell us what you&apos;re looking for and we&apos;ll let you know when it comes up.</p>
          <Link
            href='/contact?topic=buying'
            className={buttonVariants({ className: 'mt-6' })}>
            Tell us what you need
          </Link>
        </div>
      )}
    </ListingsShell>
  );
}

function ListingsShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      id='listings'
      aria-label='Latest listings'
      className='scroll-mt-20 bg-ink-50 py-20 lg:py-28'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>{children}</div>
    </section>
  );
}

export function ListingsSkeleton() {
  return (
    <ListingsShell>
      <div className='h-12 w-72 animate-pulse rounded-lg bg-muted' />
      <div className='mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className='overflow-hidden rounded-2xl border bg-card'>
            <div className='aspect-4/3 animate-pulse bg-muted' />
            <div className='space-y-3 p-5'>
              <div className='h-6 w-40 animate-pulse rounded bg-muted' />
              <div className='h-4 w-56 animate-pulse rounded bg-muted' />
            </div>
          </div>
        ))}
      </div>
    </ListingsShell>
  );
}
