import type {
  Availability,
  DocumentType,
  Furnishing,
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from "@/lib/generated/prisma/enums";

/**
 * Human labels for the property enums. Client-safe (no server imports), so the
 * admin form, tables and public pages can all share them.
 */

export const CATEGORY_OPTIONS: Record<PropertyCategory, { label: string; hint: string }> = {
  RESIDENTIAL: { label: "Residential", hint: "Houses, flats, duplexes" },
  LAND: { label: "Land", hint: "Plots, acres, farmland" },
  COMMERCIAL: { label: "Commercial", hint: "Offices, shops, hotels" },
  MIXED_USE: { label: "Mixed use", hint: "Homes with shops or offices" },
  INDUSTRIAL: { label: "Industrial", hint: "Warehouses, factories" },
  AGRICULTURAL: { label: "Agricultural", hint: "Working farms" },
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  RESIDENTIAL_LAND: "Residential land",
  COMMERCIAL_LAND: "Commercial land",
  FARMLAND: "Farmland",
  APARTMENT: "Apartment / flat",
  BUNGALOW: "Bungalow",
  DUPLEX: "Duplex",
  SEMI_DETACHED_DUPLEX: "Semi-detached duplex",
  TERRACE: "Terrace",
  DETACHED_HOUSE: "Detached house",
  PENTHOUSE: "Penthouse",
  MAISONETTE: "Maisonette",
  STUDIO: "Studio / self-contain",
  OFFICE: "Office space",
  SHOP: "Shop",
  WAREHOUSE: "Warehouse",
  HOTEL: "Hotel",
  EVENT_CENTRE: "Event centre",
  FILLING_STATION: "Filling station",
  OTHER: "Other",
};

export const LISTING_TYPE_OPTIONS: Record<ListingType, { label: string; hint: string }> = {
  SALE: { label: "For sale", hint: "One-off price" },
  RENT: { label: "For rent", hint: "Paid yearly or monthly" },
  LEASE: { label: "For lease", hint: "Long-term lease" },
  SHORT_LET: { label: "Short let", hint: "Nightly or weekly stays" },
};

export const PRICE_PERIOD_LABEL: Record<PricePeriod, string> = {
  TOTAL: "One-off total",
  PER_YEAR: "Per year",
  PER_MONTH: "Per month",
  PER_WEEK: "Per week",
  PER_NIGHT: "Per night",
};

/** Which charging periods fit each listing type. The first is the default. */
export const PRICE_PERIODS_BY_LISTING: Record<ListingType, readonly PricePeriod[]> = {
  SALE: ["TOTAL"],
  RENT: ["PER_YEAR", "PER_MONTH"],
  LEASE: ["PER_YEAR", "PER_MONTH"],
  SHORT_LET: ["PER_NIGHT", "PER_WEEK", "PER_MONTH"],
};

export const SIZE_UNIT_LABEL: Record<SizeUnit, string> = {
  PLOT: "Plots",
  SQM: "Square metres",
  SQFT: "Square feet",
  ACRE: "Acres",
  HECTARE: "Hectares",
};

export const FURNISHING_LABEL: Record<Furnishing, string> = {
  UNFURNISHED: "Unfurnished",
  SEMI_FURNISHED: "Semi-furnished",
  FURNISHED: "Fully furnished",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  AVAILABLE: "Available",
  UNDER_OFFER: "Under offer",
  SOLD: "Sold",
  RENTED: "Rented",
  OFF_MARKET: "Off market",
};

export const CURRENCIES = {
  NGN: { label: "NGN · Naira", symbol: "₦" },
  USD: { label: "USD · US dollar", symbol: "$" },
  GBP: { label: "GBP · Pound", symbol: "£" },
  EUR: { label: "EUR · Euro", symbol: "€" },
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;

/** Common Nigerian title documents, offered as suggestions (the field is free text). */
export const TITLE_SUGGESTIONS = [
  "Certificate of Occupancy (C of O)",
  "Governor's Consent",
  "Deed of Assignment",
  "Registered Survey",
  "Gazette",
  "Excision",
  "Right of Occupancy (R of O)",
  "Deed of Sublease",
] as const;

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  TITLE_DOCUMENT: "Title document (C of O, Consent…)",
  SURVEY_PLAN: "Survey plan",
  DEED: "Deed of assignment",
  BUILDING_APPROVAL: "Building approval",
  RECEIPT: "Receipt",
  OTHER: "Other",
};
