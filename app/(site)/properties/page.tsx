import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingFilters } from '@/components/listing/listing-filters';
import { ListingPagination } from '@/components/listing/listing-pagination';
import { PropertyCard } from '@/components/listing/property-card';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getListingStates, searchListings } from '@/lib/listings/queries';
import { isFiltered, LISTING_KINDS, LISTINGS_PATH, PAGE_SIZE, parseListingSearch, type ListingSearch } from '@/lib/listings/search';

export const metadata: Metadata = {
  title: 'Properties for sale and rent in Nigeria',
  description:
    'Search houses, flats and land for sale or rent in Lagos, Abuja, Ogun and beyond. Every listing shows its title document up front.',
  // Filtered and paged views all point search engines at the one main list.
  alternates: { canonical: LISTINGS_PATH },
};

export default function PropertiesPage({ searchParams }: PageProps<'/properties'>) {
  return (
    <div className='mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 lg:pt-14 lg:pb-28'>
      {/* Reads the URL's filters, so it renders per request; the queries themselves are cached. */}
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<'/properties'>['searchParams'] }) {
  const search = parseListingSearch(await searchParams);
  const [{ listings, total, page, pageCount }, states] = await Promise.all([searchListings(search), getListingStates()]);
  const shown = { ...search, page };
  const from = (page - 1) * PAGE_SIZE + 1;

  return (
    <>
      <header className='mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
        <div>
          <h1 className='text-h1 text-ink-950'>
            {LISTING_KINDS[search.kind].heading}
            {search.state && <span className='text-muted-foreground'> in {search.state}</span>}
          </h1>
          <p className='mt-2 text-muted-foreground'>
            {total === 0
              ? 'No properties match yet.'
              : total <= PAGE_SIZE
                ? `${total} ${total === 1 ? 'property' : 'properties'}`
                : `Showing ${from}–${Math.min(from + PAGE_SIZE - 1, total)} of ${total} properties`}
            {search.q && <> matching &ldquo;{search.q}&rdquo;</>}
          </p>
        </div>
      </header>

      <ListingFilters
        search={shown}
        states={states}>
        {listings.length > 0 ? (
          <>
            <ul className='mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {listings.map(p => (
                <li key={p.id}>
                  <PropertyCard
                    property={p}
                    headingLevel='h2'
                  />
                </li>
              ))}
            </ul>
            <ListingPagination
              search={shown}
              page={page}
              pageCount={pageCount}
            />
          </>
        ) : (
          <EmptyResults search={search} />
        )}
      </ListingFilters>
    </>
  );
}

function EmptyResults({ search }: { search: ListingSearch }) {
  const topic = search.kind === 'rent' ? 'renting' : 'buying';
  return (
    <div className='mt-4 rounded-[2rem] border border-dashed bg-ink-50 px-6 py-14 text-center'>
      <h2 className='text-h3'>Nothing matches all of those filters.</h2>
      <p className='mx-auto mt-2 max-w-md text-muted-foreground'>
        Try a wider budget or a nearby area. Or tell us what you need and we&apos;ll let you know when it comes up.
      </p>
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        {isFiltered(search) && (
          <Link
            href={LISTINGS_PATH}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Clear filters
          </Link>
        )}
        <Link
          href={`/contact?topic=${topic}`}
          className={buttonVariants({ size: 'lg' })}>
          Tell us what you need
        </Link>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className='h-12 w-full max-w-md rounded-xl' />
      <Skeleton className='mt-3 h-5 w-48' />
      <Skeleton className='mt-8 h-30 w-full rounded-[1.75rem] lg:h-27' />
      <div className='mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className='overflow-hidden rounded-2xl border bg-card'>
            <Skeleton className='aspect-4/3 rounded-none' />
            <div className='space-y-3 p-5'>
              <Skeleton className='h-6 w-40' />
              <Skeleton className='h-4 w-56' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
