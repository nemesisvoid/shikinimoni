import { Suspense } from "react";
import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Listings, ListingsSkeleton } from "@/components/landing/listings";
import { SellerCta } from "@/components/landing/seller-cta";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} | Land and homes with papers you can trust`,
  description: siteConfig.description,
};

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Hero />
      {/* Reads ?type= and ?q=, so it renders per request; the rest of the page is prerendered. */}
      <Suspense fallback={<ListingsSkeleton />}>
        <Listings searchParams={searchParams} />
      </Suspense>
      <HowItWorks />
      <SellerCta />
    </>
  );
}
