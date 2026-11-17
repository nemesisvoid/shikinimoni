import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Listings, ListingsSkeleton } from '@/components/landing/listings';
import { SellerCta } from '@/components/landing/seller-cta';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} | ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <Hero />
      {/* Cached database read: part of the prerendered page, refreshed when an admin publishes. */}
      <Suspense fallback={<ListingsSkeleton />}>
        <Listings />
      </Suspense>
      <HowItWorks />
      <SellerCta />
    </>
  );
}
