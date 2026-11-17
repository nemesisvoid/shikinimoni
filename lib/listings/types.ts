import type {
  Availability,
  DocumentType,
  Furnishing,
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from '@/lib/generated/prisma/enums';

/**
 * Plain, serialisable shapes for the public site. Decimals are converted to
 * numbers before they leave lib/listings/queries.ts, so these are safe to cache
 * and to pass to Client Components.
 */

export type ListingPhoto = { url: string; alt: string };

/** What a listing card needs. */
export type ListingCardData = {
  id: string;
  slug: string;
  name: string;
  category: PropertyCategory;
  type: PropertyType;
  listingType: ListingType;
  availability: Availability;
  price: number | null;
  currency: string;
  pricePeriod: PricePeriod;
  landSize: number | null;
  landSizeUnit: SizeUnit | null;
  floorAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  neighborhood: string | null;
  city: string;
  state: string;
  titleType: string | null;
  isFeatured: boolean;
  coverImage: ListingPhoto | null;
};

/** Everything the property page shows. Street address and pin are null when the admin hid them. */
export type ListingDetail = ListingCardData & {
  refNumber: number;
  summary: string | null;
  description: string;
  isNegotiable: boolean;
  serviceCharge: number | null;
  toilets: number | null;
  parkingSpaces: number | null;
  floors: number | null;
  yearBuilt: number | null;
  furnishing: Furnishing | null;
  address: {
    line1: string | null;
    line2: string | null;
    postalCode: string | null;
    country: string;
    exact: boolean;
  };
  coordinates: { lat: number; lng: number } | null;
  photos: (ListingPhoto & { id: string; width: number | null; height: number | null })[];
  documents: { id: string; name: string; type: DocumentType }[];
  amenities: { group: string; items: string[] }[];
  publishedAt: Date | null;
  updatedAt: Date;
};
