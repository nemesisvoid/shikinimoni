import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { LISTINGS_TAG } from './tags';
import { PAGE_SIZE, parseRefNumber, type ListingSearch } from './search';
import type { ListingCardData, ListingDetail } from './types';

/**
 * Public read queries. Only published, live listings ever leave this file, and
 * every query is cached under LISTINGS_TAG: admin saves call updateTag() so the
 * site updates straight away; otherwise entries refresh within the hour.
 */

const LIVE = { status: 'PUBLISHED', deletedAt: null } satisfies Prisma.PropertyWhereInput;

const COVER = {
  where: { type: 'IMAGE' },
  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
  take: 1,
  select: { url: true, altText: true },
} satisfies Prisma.Property$mediaArgs;

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  category: true,
  type: true,
  listingType: true,
  availability: true,
  price: true,
  currency: true,
  pricePeriod: true,
  landSize: true,
  landSizeUnit: true,
  floorAreaSqm: true,
  bedrooms: true,
  bathrooms: true,
  neighborhood: true,
  city: true,
  state: true,
  titleType: true,
  isFeatured: true,
  media: COVER,
} satisfies Prisma.PropertySelect;

type CardRow = Prisma.PropertyGetPayload<{ select: typeof CARD_SELECT }>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

function toCard({ media, price, landSize, floorAreaSqm, ...row }: CardRow): ListingCardData {
  const cover = media[0];
  return {
    ...row,
    price: num(price),
    landSize: num(landSize),
    floorAreaSqm: num(floorAreaSqm),
    coverImage: cover ? { url: cover.url, alt: cover.altText || row.name } : null,
  };
}

// ── Lists ───────────────────────────────────────────────────────────────────

/** The landing page's "latest listings": featured first, then newest. */
export async function getLatestListings(limit = 6) {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where: LIVE,
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: CARD_SELECT,
    }),
    prisma.property.count({ where: LIVE }),
  ]);
  return { listings: rows.map(toCard), total };
}

const SORT_ORDER = {
  newest: [{ publishedAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
} satisfies Record<ListingSearch['sort'], Prisma.PropertyOrderByWithRelationInput[]>;

function searchWhere(s: ListingSearch): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [];

  if (s.kind === 'sale') and.push({ listingType: 'SALE' });
  if (s.kind === 'rent') and.push({ listingType: { in: ['RENT', 'LEASE', 'SHORT_LET'] } });
  if (s.kind === 'land') and.push({ category: 'LAND' });
  if (s.beds) and.push({ bedrooms: { gte: s.beds } });
  if (s.maxPrice) and.push({ price: { lte: s.maxPrice } });
  if (s.state) and.push({ state: { equals: s.state, mode: 'insensitive' } });

  if (s.q) {
    const ref = parseRefNumber(s.q);
    if (ref !== null) {
      and.push({ refNumber: ref });
    } else {
      // Every word must appear somewhere: "lekki duplex" matches a duplex in Lekki.
      for (const word of s.q.split(' ').slice(0, 6)) {
        const contains = { contains: word, mode: 'insensitive' } as const;
        and.push({
          OR: [{ name: contains }, { neighborhood: contains }, { city: contains }, { state: contains }, { summary: contains }],
        });
      }
    }
  }
  return { ...LIVE, AND: and };
}

/** One page of /properties. A page past the end shows the last page. */
export async function searchListings(s: ListingSearch) {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  const where = searchWhere(s);
  const total = await prisma.property.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(s.page, pageCount);

  const rows = await prisma.property.findMany({
    where,
    orderBy: SORT_ORDER[s.sort],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: CARD_SELECT,
  });
  return { listings: rows.map(toCard), total, page, pageCount };
}

/** States that have at least one live listing, for the filter. */
export async function getListingStates() {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  const rows = await prisma.property.findMany({
    where: LIVE,
    distinct: ['state'],
    orderBy: { state: 'asc' },
    select: { state: true },
  });
  return rows.map(r => r.state);
}

// ── One listing ─────────────────────────────────────────────────────────────

/** The property page. Null when the slug doesn't exist, is unpublished or deleted. */
export async function getListing(slug: string): Promise<ListingDetail | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  const row = await prisma.property.findFirst({
    where: { ...LIVE, slug },
    select: {
      ...CARD_SELECT,
      refNumber: true,
      summary: true,
      description: true,
      isNegotiable: true,
      serviceCharge: true,
      toilets: true,
      parkingSpaces: true,
      floors: true,
      yearBuilt: true,
      furnishing: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
      showExactAddress: true,
      publishedAt: true,
      updatedAt: true,
      media: {
        where: { type: 'IMAGE' },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        select: { id: true, url: true, altText: true, width: true, height: true },
      },
      // Only documents the admin marked "show to buyers". Files stay private; the
      // page asks getDocumentLink() for a short-lived link when someone opens one.
      documents: { where: { isPublic: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, type: true } },
      amenities: { select: { amenity: { select: { name: true, group: true } } } },
    },
  });
  if (!row) return null;

  const { media, amenities, serviceCharge, latitude, longitude, showExactAddress, addressLine1, addressLine2, postalCode, country, ...rest } = row;
  const card = toCard({ ...rest, media: media.slice(0, 1) });

  const groups = new Map<string, string[]>();
  for (const { amenity } of amenities) {
    const group = amenity.group ?? 'Other';
    groups.set(group, [...(groups.get(group) ?? []), amenity.name]);
  }

  return {
    ...card,
    refNumber: rest.refNumber,
    summary: rest.summary,
    description: rest.description,
    isNegotiable: rest.isNegotiable,
    serviceCharge: num(serviceCharge),
    toilets: rest.toilets,
    parkingSpaces: rest.parkingSpaces,
    floors: rest.floors,
    yearBuilt: rest.yearBuilt,
    furnishing: rest.furnishing,
    address: {
      line1: showExactAddress ? addressLine1 : null,
      line2: showExactAddress ? addressLine2 : null,
      postalCode: showExactAddress ? postalCode : null,
      country,
      exact: showExactAddress,
    },
    coordinates: showExactAddress && latitude && longitude ? { lat: latitude.toNumber(), lng: longitude.toNumber() } : null,
    photos: media.map(m => ({ id: m.id, url: m.url, alt: m.altText || rest.name, width: m.width, height: m.height })),
    documents: rest.documents,
    amenities: [...groups]
      .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
      .map(([group, items]) => ({ group, items: items.sort((a, b) => a.localeCompare(b)) })),
    publishedAt: rest.publishedAt,
    updatedAt: rest.updatedAt,
  };
}

/**
 * Up to `limit` others to look at: same kind of property in the same state
 * first, then the same listing type anywhere. Available ones come first.
 */
export async function getSimilarListings(
  listing: Pick<ListingDetail, 'id' | 'category' | 'listingType' | 'state'>,
  limit = 3,
) {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  const orderBy = [{ availability: 'asc' }, { publishedAt: 'desc' }] satisfies Prisma.PropertyOrderByWithRelationInput[];
  const near = await prisma.property.findMany({
    where: { ...LIVE, id: { not: listing.id }, category: listing.category, state: listing.state },
    orderBy,
    take: limit,
    select: CARD_SELECT,
  });
  if (near.length >= limit) return near.map(toCard);

  const more = await prisma.property.findMany({
    where: { ...LIVE, id: { notIn: [listing.id, ...near.map(r => r.id)] }, listingType: listing.listingType },
    orderBy,
    take: limit - near.length,
    select: CARD_SELECT,
  });
  return [...near, ...more].map(toCard);
}

/** Every live listing's address and last change, for the sitemap and prerendering. */
export async function getListingSitemap() {
  'use cache';
  cacheLife('hours');
  cacheTag(LISTINGS_TAG);

  return prisma.property.findMany({
    where: LIVE,
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, updatedAt: true },
  });
}
