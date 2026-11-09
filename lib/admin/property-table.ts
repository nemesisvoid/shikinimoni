import type {
  Availability,
  ListingStatus,
  ListingType,
  PricePeriod,
  PropertyCategory,
} from "@/lib/generated/prisma/enums";
import type { PropertySort } from "@/schemas/property.schema";

/**
 * Shared by the admin properties page (server) and its table (client). Plain
 * values must live here, not in the 'use client' table file: a server component
 * importing a constant from a client module gets a reference, not the value.
 */
export const DEFAULT_SORT: PropertySort = "updated";
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZES = [10, 20, 50, 100];

/** A row as the server sends it: plain values only (no Decimal or Date). */
export type AdminPropertyRow = {
  id: string;
  refNumber: number;
  name: string;
  location: string;
  status: ListingStatus;
  availability: Availability;
  listingType: ListingType;
  category: PropertyCategory;
  isFeatured: boolean;
  price: string | null;
  currency: string;
  pricePeriod: PricePeriod;
  updatedAt: string;
  coverUrl: string | null;
};

/** Everything that lives in the URL. */
export type PropertyTableQuery = {
  q?: string;
  status?: ListingStatus;
  listingType?: ListingType;
  category?: PropertyCategory;
  availability?: Availability;
  sort: PropertySort;
  page: number;
  pageSize: number;
};
