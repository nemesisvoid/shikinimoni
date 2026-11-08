import type {
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from "@/lib/generated/prisma/enums";

/**
 * The fields a listing card needs. Names and enum values mirror the Prisma
 * `Property` model, so swapping DUMMY_PROPERTIES for a `prisma.property.findMany`
 * (with `select` + the cover image from `media`) only changes the data source.
 */
export type ListingCardData = {
  id: string;
  slug: string;
  name: string;
  category: PropertyCategory;
  type: PropertyType;
  listingType: ListingType;
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
  coverImage: { url: string; alt: string };
};

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=75`;

// Placeholder content for layout work. Prices, places and titles are illustrative.
export const DUMMY_PROPERTIES: ListingCardData[] = [
  {
    id: "p-001",
    slug: "5-bedroom-detached-duplex-banana-island",
    name: "5-bedroom detached duplex with pool",
    category: "RESIDENTIAL",
    type: "DETACHED_HOUSE",
    listingType: "SALE",
    price: 850_000_000,
    currency: "NGN",
    pricePeriod: "TOTAL",
    landSize: 1000,
    landSizeUnit: "SQM",
    floorAreaSqm: 620,
    bedrooms: 5,
    bathrooms: 6,
    neighborhood: "Banana Island",
    city: "Ikoyi",
    state: "Lagos",
    titleType: "C of O",
    isFeatured: true,
    coverImage: { url: photo("1600596542815-ffad4c1539a9"), alt: "White two-storey house with a lit pool at dusk" },
  },
  {
    id: "p-002",
    slug: "4-bedroom-semi-detached-duplex-lekki-phase-1",
    name: "4-bedroom semi-detached duplex",
    category: "RESIDENTIAL",
    type: "SEMI_DETACHED_DUPLEX",
    listingType: "SALE",
    price: 185_000_000,
    currency: "NGN",
    pricePeriod: "TOTAL",
    landSize: null,
    landSizeUnit: null,
    floorAreaSqm: 340,
    bedrooms: 4,
    bathrooms: 5,
    neighborhood: "Lekki Phase 1",
    city: "Lekki",
    state: "Lagos",
    titleType: "Governor's Consent",
    isFeatured: false,
    coverImage: { url: photo("1580587771525-78b9dba3b914"), alt: "Modern duplex with a pool and garden" },
  },
  {
    id: "p-003",
    slug: "2-plots-residential-land-ibeju-lekki",
    name: "2 plots of dry residential land",
    category: "LAND",
    type: "RESIDENTIAL_LAND",
    listingType: "SALE",
    price: 12_000_000,
    currency: "NGN",
    pricePeriod: "TOTAL",
    landSize: 2,
    landSizeUnit: "PLOT",
    floorAreaSqm: null,
    bedrooms: null,
    bathrooms: null,
    neighborhood: "Eleko",
    city: "Ibeju-Lekki",
    state: "Lagos",
    titleType: "C of O",
    isFeatured: false,
    coverImage: { url: photo("1500382017468-9049fed747ef"), alt: "Open grassland at sunrise" },
  },
  {
    id: "p-004",
    slug: "3-bedroom-apartment-gwarinpa",
    name: "3-bedroom serviced apartment",
    category: "RESIDENTIAL",
    type: "APARTMENT",
    listingType: "RENT",
    price: 4_500_000,
    currency: "NGN",
    pricePeriod: "PER_YEAR",
    landSize: null,
    landSizeUnit: null,
    floorAreaSqm: 165,
    bedrooms: 3,
    bathrooms: 3,
    neighborhood: "Gwarinpa",
    city: "Abuja",
    state: "FCT",
    titleType: null,
    isFeatured: false,
    coverImage: { url: photo("1493809842364-78817add7ffb"), alt: "Bright living room with a blue sofa and wooden floor" },
  },
  {
    id: "p-005",
    slug: "3-bedroom-bungalow-mowe",
    name: "3-bedroom bungalow in a gated estate",
    category: "RESIDENTIAL",
    type: "BUNGALOW",
    listingType: "SALE",
    price: 38_000_000,
    currency: "NGN",
    pricePeriod: "TOTAL",
    landSize: 1,
    landSizeUnit: "PLOT",
    floorAreaSqm: 180,
    bedrooms: 3,
    bathrooms: 3,
    neighborhood: "Mowe",
    city: "Obafemi Owode",
    state: "Ogun",
    titleType: "Governor's Consent",
    isFeatured: false,
    coverImage: { url: photo("1512917774080-9991f1c4c750"), alt: "White single-storey house with palm trees" },
  },
  {
    id: "p-006",
    slug: "mini-flat-yaba",
    name: "Mini flat close to UNILAG",
    category: "RESIDENTIAL",
    type: "STUDIO",
    listingType: "RENT",
    price: 1_800_000,
    currency: "NGN",
    pricePeriod: "PER_YEAR",
    landSize: null,
    landSizeUnit: null,
    floorAreaSqm: 48,
    bedrooms: 1,
    bathrooms: 1,
    neighborhood: "Akoka",
    city: "Yaba",
    state: "Lagos",
    titleType: null,
    isFeatured: false,
    coverImage: { url: photo("1502672260266-1c1ef2d93688"), alt: "Small sunlit living room with plants and a grey sofa" },
  },
  {
    id: "p-007",
    slug: "2-bedroom-short-let-lekki",
    name: "2-bedroom short-let apartment",
    category: "RESIDENTIAL",
    type: "APARTMENT",
    listingType: "SHORT_LET",
    price: 85_000,
    currency: "NGN",
    pricePeriod: "PER_NIGHT",
    landSize: null,
    landSizeUnit: null,
    floorAreaSqm: 110,
    bedrooms: 2,
    bathrooms: 2,
    neighborhood: "Oniru",
    city: "Victoria Island",
    state: "Lagos",
    titleType: null,
    isFeatured: false,
    coverImage: { url: photo("1522708323590-d24dbb6b0267"), alt: "Open-plan apartment with a dining table and red armchair" },
  },
  {
    id: "p-008",
    slug: "open-plan-office-victoria-island",
    name: "Open-plan office floor",
    category: "COMMERCIAL",
    type: "OFFICE",
    listingType: "LEASE",
    price: 25_000_000,
    currency: "NGN",
    pricePeriod: "PER_YEAR",
    landSize: null,
    landSizeUnit: null,
    floorAreaSqm: 240,
    bedrooms: null,
    bathrooms: 2,
    neighborhood: "Adeola Odeku",
    city: "Victoria Island",
    state: "Lagos",
    titleType: null,
    isFeatured: false,
    coverImage: { url: photo("1497366216548-37526070297c"), alt: "Empty modern office floor with glass partitions" },
  },
  {
    id: "p-009",
    slug: "5-bedroom-duplex-asokoro",
    name: "5-bedroom duplex with garden pool",
    category: "RESIDENTIAL",
    type: "DETACHED_HOUSE",
    listingType: "SALE",
    price: 650_000_000,
    currency: "NGN",
    pricePeriod: "TOTAL",
    landSize: 1500,
    landSizeUnit: "SQM",
    floorAreaSqm: 540,
    bedrooms: 5,
    bathrooms: 6,
    neighborhood: "Asokoro",
    city: "Abuja",
    state: "FCT",
    titleType: "C of O",
    isFeatured: false,
    coverImage: { url: photo("1599809275671-b5942cabc7a2"), alt: "Warm-toned villa with a round pool at sunset" },
  },
];

export const HERO_IMAGE = {
  url: photo("1613490493576-7fde63acd811"),
  alt: "Symmetrical modern white house with a long pool in front",
};
