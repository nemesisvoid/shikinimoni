import type { Metadata } from 'next';
import { formatPrice, LISTING_TYPE_LABEL } from '@/lib/format';
import { siteConfig } from '@/lib/site';
import { locationLine } from './format';
import { LISTINGS_PATH, listingSearchHref, propertyPath } from './search';
import type { ListingDetail } from './types';

/** Trim to a sentence-ish boundary for meta descriptions (~160 characters). */
function clip(text: string, max = 160) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:]$/, '')}…`;
}

export function listingMetadata(p: ListingDetail): Metadata {
  const { amount, suffix } = formatPrice(p.price, p.currency, p.pricePeriod);
  const where = [p.city, p.state].filter((v, i, all) => all.indexOf(v) === i).join(', ');
  const title = `${p.name} in ${where}`;
  const lead = `${LISTING_TYPE_LABEL[p.listingType]} in ${locationLine(p)}: ${amount}${suffix}.`;
  const body = p.summary ?? p.description;
  const titleNote = p.titleType && !body.toLowerCase().includes(p.titleType.toLowerCase()) ? `${p.titleType}. ` : '';
  const description = clip(`${lead} ${titleNote}${body}`);
  const url = propertyPath(p.slug);
  const images = p.photos.slice(0, 4).map(photo => ({ url: photo.url, alt: photo.alt }));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, images, siteName: siteConfig.name, locale: 'en_NG' },
    twitter: { card: images.length > 0 ? 'summary_large_image' : 'summary', title, description, images },
  };
}

const OFFER_AVAILABILITY: Record<ListingDetail['availability'], string> = {
  AVAILABLE: 'https://schema.org/InStock',
  UNDER_OFFER: 'https://schema.org/LimitedAvailability',
  SOLD: 'https://schema.org/SoldOut',
  RENTED: 'https://schema.org/SoldOut',
  OFF_MARKET: 'https://schema.org/Discontinued',
};

/** schema.org RealEstateListing plus breadcrumbs, for search results. */
export function listingJsonLd(p: ListingDetail) {
  const url = `${siteConfig.url}${propertyPath(p.slug)}`;
  const place = {
    '@type': p.category === 'LAND' ? 'Landform' : p.category === 'RESIDENTIAL' ? 'Residence' : 'Place',
    name: p.name,
    address: {
      '@type': 'PostalAddress',
      ...(p.address.line1 ? { streetAddress: [p.address.line1, p.address.line2].filter(Boolean).join(', ') } : {}),
      addressLocality: p.neighborhood ? `${p.neighborhood}, ${p.city}` : p.city,
      addressRegion: p.state,
      ...(p.address.postalCode ? { postalCode: p.address.postalCode } : {}),
      addressCountry: p.address.country,
    },
    ...(p.coordinates ? { geo: { '@type': 'GeoCoordinates', latitude: p.coordinates.lat, longitude: p.coordinates.lng } } : {}),
    ...(p.bedrooms !== null ? { numberOfBedrooms: p.bedrooms } : {}),
    ...(p.bathrooms !== null ? { numberOfBathroomsTotal: p.bathrooms } : {}),
    ...(p.floorAreaSqm !== null ? { floorSize: { '@type': 'QuantitativeValue', value: p.floorAreaSqm, unitCode: 'MTK' } } : {}),
    ...(p.amenities.length > 0
      ? {
          amenityFeature: p.amenities.flatMap(g =>
            g.items.map(name => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
          ),
        }
      : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        '@id': url,
        url,
        name: p.name,
        description: clip(p.summary ?? p.description, 500),
        ...(p.publishedAt ? { datePosted: p.publishedAt.toISOString() } : {}),
        dateModified: p.updatedAt.toISOString(),
        ...(p.photos.length > 0 ? { image: p.photos.map(photo => photo.url) } : {}),
        about: place,
        ...(p.price !== null
          ? {
              offers: {
                '@type': 'Offer',
                price: p.price,
                priceCurrency: p.currency,
                availability: OFFER_AVAILABILITY[p.availability],
                businessFunction:
                  p.listingType === 'SALE' ? 'http://purl.org/goodrelations/v1#Sell' : 'http://purl.org/goodrelations/v1#LeaseOut',
                url,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { name: 'Home', path: '/' },
          { name: 'Properties', path: LISTINGS_PATH },
          { name: p.state, path: listingSearchHref({ state: p.state }) },
          { name: p.name, path: propertyPath(p.slug) },
        ].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${siteConfig.url}${c.path}` })),
      },
    ],
  };
}

/** JSON for a <script> tag: "<" escaped so listing text can't close the tag. */
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
