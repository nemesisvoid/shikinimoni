import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhotoGallery } from '@/components/listing/photo-gallery';
import { PropertyCard } from '@/components/listing/property-card';
import {
  Amenities,
  Description,
  DetailsTable,
  EnquiryCard,
  KeyFacts,
  Location,
  MobileEnquiryBar,
  PropertyBreadcrumbs,
  PropertyTitle,
  TitlePapers,
} from '@/components/listing/property-sections';
import { Skeleton } from '@/components/ui/skeleton';
import { getListing, getListingSitemap, getSimilarListings } from '@/lib/listings/queries';
import { listingJsonLd, listingMetadata, safeJson } from '@/lib/listings/seo';
import type { ListingDetail } from '@/lib/listings/types';

/** How many listings to prerender at build; the rest render on first visit and are then cached. */
const PRERENDER_COUNT = 50;

export async function generateStaticParams() {
  const listings = await getListingSitemap();
  // Cache Components needs at least one entry; a placeholder slug renders the 404.
  if (listings.length === 0) return [{ slug: '__none__' }];
  return listings.slice(0, PRERENDER_COUNT).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/properties/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: 'Property not found', robots: { index: false } };
  return listingMetadata(listing);
}

export default function PropertyPage({ params }: PageProps<'/properties/[slug]'>) {
  return (
    // params are read inside the boundary, so a listing that wasn't prerendered
    // still gets an instant shell, then is cached after its first visit.
    <Suspense fallback={<PropertySkeleton />}>
      <PropertyView params={params} />
    </Suspense>
  );
}

async function PropertyView({ params }: { params: PageProps<'/properties/[slug]'>['params'] }) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: safeJson(listingJsonLd(listing)) }}
      />

      <article className='mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-24'>
        <PropertyBreadcrumbs listing={listing} />
        <div className='mt-6'>
          <PropertyTitle listing={listing} />
        </div>
        <div className='mt-8'>
          <PhotoGallery
            photos={listing.photos}
            name={listing.name}
          />
        </div>

        <div className='mt-10 grid items-start gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_26rem]'>
          <div className='flex min-w-0 flex-col gap-10'>
            <KeyFacts listing={listing} />
            <TitlePapers listing={listing} />
            <Description listing={listing} />
            <Amenities listing={listing} />
            <DetailsTable listing={listing} />
            <Location listing={listing} />
          </div>
          <aside
            aria-label='Price and enquiry'
            className='lg:sticky lg:top-24'>
            <EnquiryCard listing={listing} />
          </aside>
        </div>
      </article>

      <Suspense fallback={null}>
        <SimilarListings listing={listing} />
      </Suspense>

      <MobileEnquiryBar listing={listing} />
    </>
  );
}

async function SimilarListings({ listing }: { listing: ListingDetail }) {
  const similar = await getSimilarListings(listing);
  if (similar.length === 0) return null;
  return (
    <section
      aria-labelledby='similar-heading'
      className='bg-ink-50 py-16 lg:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <h2
          id='similar-heading'
          className='text-h2'>
          More like this
        </h2>
        <ul className='mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {similar.map(p => (
            <li key={p.id}>
              <PropertyCard property={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PropertySkeleton() {
  return (
    <div
      aria-hidden
      className='mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-8'>
      <Skeleton className='h-4 w-64' />
      <Skeleton className='mt-8 h-7 w-48 rounded-full' />
      <Skeleton className='mt-4 h-12 w-full max-w-2xl rounded-xl' />
      <Skeleton className='mt-3 h-6 w-72' />
      <Skeleton className='mt-8 aspect-video w-full rounded-[2rem] lg:aspect-auto lg:h-[30rem]' />
      <div className='mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_24rem]'>
        <div className='space-y-6'>
          <Skeleton className='h-28 w-full rounded-2xl' />
          <Skeleton className='h-48 w-full rounded-[2rem]' />
          <Skeleton className='h-40 w-full rounded-2xl' />
        </div>
        <Skeleton className='hidden h-[34rem] rounded-[2rem] lg:block' />
      </div>
    </div>
  );
}
