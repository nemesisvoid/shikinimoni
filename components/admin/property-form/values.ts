import type { Property } from "@/lib/generated/prisma/client";
import type {
  Availability,
  Furnishing,
  ListingStatus,
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from "@/lib/generated/prisma/enums";
import { formatAmount } from "@/lib/format";
import { SQM_PER_UNIT } from "@/schemas/property.schema";

/**
 * What the inputs hold while the admin edits. Text and number inputs are strings
 * ("" = empty) and choices are "" until picked; CreatePropertySchema converts
 * everything (blank → null, "25,000,000" → "25000000", "3" → 3) on submit, the
 * same way it does for FormData on the server.
 */
export type PropertyFormValues = {
  // Basics
  name: string;
  slug: string;
  summary: string;
  description: string;

  // Listing
  listingType: ListingType;
  category: PropertyCategory | "";
  type: PropertyType | "";
  titleType: string;

  // Price
  price: string;
  currency: string;
  pricePeriod: PricePeriod;
  isNegotiable: boolean;
  serviceCharge: string;

  // Size and rooms
  landSize: string;
  landSizeUnit: SizeUnit | "";
  landAreaSqm: string;
  floorAreaSqm: string;
  bedrooms: string;
  bathrooms: string;
  toilets: string;
  parkingSpaces: string;
  floors: string;
  yearBuilt: string;
  furnishing: Furnishing | "";

  // Location
  addressLine1: string;
  addressLine2: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  showExactAddress: boolean;

  // Amenities
  amenityIds: number[];

  // Publishing
  status: ListingStatus;
  availability: Availability;
  isFeatured: boolean;
};

export const EMPTY_PROPERTY: PropertyFormValues = {
  name: "",
  slug: "",
  summary: "",
  description: "",
  listingType: "SALE",
  category: "",
  type: "",
  titleType: "",
  price: "",
  currency: "NGN",
  pricePeriod: "TOTAL",
  isNegotiable: false,
  serviceCharge: "",
  landSize: "",
  landSizeUnit: "PLOT",
  landAreaSqm: "",
  floorAreaSqm: "",
  bedrooms: "",
  bathrooms: "",
  toilets: "",
  parkingSpaces: "",
  floors: "",
  yearBuilt: "",
  furnishing: "",
  addressLine1: "",
  addressLine2: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "NG",
  postalCode: "",
  latitude: "",
  longitude: "",
  showExactAddress: true,
  amenityIds: [],
  status: "DRAFT",
  availability: "AVAILABLE",
  isFeatured: false,
};

/**
 * A saved property as the edit form shows it: numbers as the text the admin
 * would have typed ("85,000,000"), nulls as "". Runs on the server.
 */
export function toFormValues(property: Property, amenityIds: number[]): PropertyFormValues {
  const text = (v: { toString(): string } | string | number | null) => (v === null ? "" : String(v));
  const amount = (v: { toString(): string } | null) => (v === null ? "" : formatAmount(String(v)));
  // landAreaSqm is filled from the size when left blank. If it still matches that
  // estimate, show it blank again so it follows any change to the size.
  const estimatedSqm =
    property.landSize !== null && property.landSizeUnit !== null
      ? Math.round(Number(property.landSize) * SQM_PER_UNIT[property.landSizeUnit] * 100) / 100
      : null;
  const landAreaIsEstimate = property.landAreaSqm !== null && Number(property.landAreaSqm) === estimatedSqm;
  return {
    name: property.name,
    slug: property.slug,
    summary: text(property.summary),
    description: property.description,
    listingType: property.listingType,
    category: property.category,
    type: property.type,
    titleType: text(property.titleType),
    price: amount(property.price),
    currency: property.currency,
    pricePeriod: property.pricePeriod,
    isNegotiable: property.isNegotiable,
    serviceCharge: amount(property.serviceCharge),
    landSize: text(property.landSize),
    landSizeUnit: property.landSizeUnit ?? "PLOT",
    landAreaSqm: landAreaIsEstimate ? "" : amount(property.landAreaSqm),
    floorAreaSqm: amount(property.floorAreaSqm),
    bedrooms: text(property.bedrooms),
    bathrooms: text(property.bathrooms),
    toilets: text(property.toilets),
    parkingSpaces: text(property.parkingSpaces),
    floors: text(property.floors),
    yearBuilt: text(property.yearBuilt),
    furnishing: property.furnishing ?? "",
    addressLine1: text(property.addressLine1),
    addressLine2: text(property.addressLine2),
    neighborhood: text(property.neighborhood),
    city: property.city,
    state: property.state,
    country: property.country,
    postalCode: text(property.postalCode),
    latitude: text(property.latitude),
    longitude: text(property.longitude),
    showExactAddress: property.showExactAddress,
    amenityIds,
    status: property.status,
    availability: property.availability,
    isFeatured: property.isFeatured,
  };
}

/** Fields that only describe a building; hidden (and cleared) for land. */
export const BUILDING_FIELDS = [
  "floorAreaSqm",
  "bedrooms",
  "bathrooms",
  "toilets",
  "parkingSpaces",
  "floors",
  "yearBuilt",
  "furnishing",
] as const satisfies readonly (keyof PropertyFormValues)[];

/**
 * Tidies values before validation. The unit picker always has a value, so drop
 * it when no size was typed; otherwise the schema would ask for a size that's
 * optional for buildings.
 */
export function toSchemaInput(values: PropertyFormValues) {
  return {
    ...values,
    landSizeUnit: values.landSize.trim() === "" ? "" : values.landSizeUnit,
  };
}

/** Form sections, in page order. Used for the jump links and their error dots. */
export const FORM_SECTIONS = [
  { id: "basics", title: "Basics", fields: ["name", "summary", "description", "slug"] },
  { id: "photos", title: "Photos", fields: [] },
  { id: "listing", title: "Listing type", fields: ["listingType", "category", "type", "titleType"] },
  { id: "documents", title: "Documents", fields: [] },
  { id: "price", title: "Price", fields: ["price", "currency", "pricePeriod", "isNegotiable", "serviceCharge"] },
  { id: "size", title: "Size and rooms", fields: ["landSize", "landSizeUnit", "landAreaSqm", ...BUILDING_FIELDS] },
  {
    id: "location",
    title: "Location",
    fields: [
      "addressLine1",
      "addressLine2",
      "neighborhood",
      "city",
      "state",
      "country",
      "postalCode",
      "latitude",
      "longitude",
      "showExactAddress",
    ],
  },
  { id: "amenities", title: "Amenities", fields: ["amenityIds"] },
  { id: "publishing", title: "Publishing", fields: ["status", "availability", "isFeatured"] },
] as const satisfies readonly { id: string; title: string; fields: readonly (keyof PropertyFormValues)[] }[];
