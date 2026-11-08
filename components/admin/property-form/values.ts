import type {
  Availability,
  Furnishing,
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from "@/lib/generated/prisma/enums";

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
  status: "DRAFT" | "PUBLISHED";
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
  { id: "listing", title: "Listing type", fields: ["listingType", "category", "type", "titleType"] },
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
