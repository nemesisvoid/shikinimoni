/**
 * Development seed: sample listings (with photo galleries, specs and copy for the
 * public property pages), plus amenities and enquiries for the admin dashboard. Safe to re-run (upserts by slug;
 * seeded enquiries are replaced).
 *
 *   npm run db:seed          (alias for `prisma db seed`)
 *
 * Refuses to run on the `production` Neon branch unless SEED_ALLOW_PRODUCTION=1.
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { Availability, InquiryStatus, InquiryType, ListingStatus } from "../lib/generated/prisma/enums";
import type { Furnishing } from "../lib/generated/prisma/enums";
import { DUMMY_PROPERTIES, SEED_GALLERY } from "../lib/data/dummy-properties";

config({ path: [".env.local", ".env"], quiet: true });

const branch = process.env.NEON_BRANCH;
if (branch === "production" && process.env.SEED_ALLOW_PRODUCTION !== "1") {
  console.error("Refusing to seed the production branch. Set SEED_ALLOW_PRODUCTION=1 if you really mean it.");
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set. Run `neon env pull`.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const SEED_EMAIL_DOMAIN = "@seed.shikinimoni.test";
const daysAgo = (d: number, h = 0) => new Date(Date.now() - (d * 24 + h) * 60 * 60 * 1000);

const AMENITIES = [
  { name: "24/7 power", group: "Utilities" },
  { name: "Borehole water", group: "Utilities" },
  { name: "Gated estate", group: "Security" },
  { name: "CCTV", group: "Security" },
  { name: "Swimming pool", group: "Leisure" },
  { name: "Fitted kitchen", group: "Interior" },
  { name: "Boys' quarters", group: "Interior" },
  { name: "Parking", group: "Outdoor" },
  { name: "Good road access", group: "Outdoor" },
  { name: "Fenced", group: "Outdoor" },
  { name: "Air conditioning", group: "Interior" },
  { name: "Elevator", group: "Interior" },
  { name: "Gym", group: "Leisure" },
  { name: "Serviced", group: "Utilities" },
];

/** Status/availability per dummy listing, so every dashboard state has data. */
const STATE: Record<string, { status: ListingStatus; availability: Availability; updated: number; amenities: string[] }> = {
  "p-001": { status: "PUBLISHED", availability: "AVAILABLE", updated: 1, amenities: ["24/7 power", "Swimming pool", "Gated estate", "CCTV", "Boys' quarters"] },
  "p-002": { status: "PUBLISHED", availability: "UNDER_OFFER", updated: 2, amenities: ["24/7 power", "Fitted kitchen", "Parking"] },
  "p-003": { status: "PUBLISHED", availability: "AVAILABLE", updated: 4, amenities: ["Good road access", "Fenced", "Gated estate"] },
  "p-004": { status: "PUBLISHED", availability: "RENTED", updated: 6, amenities: ["24/7 power", "Borehole water", "Parking"] },
  "p-005": { status: "PUBLISHED", availability: "SOLD", updated: 9, amenities: ["Gated estate", "Borehole water"] },
  "p-006": { status: "PUBLISHED", availability: "AVAILABLE", updated: 3, amenities: ["Borehole water"] },
  "p-007": { status: "DRAFT", availability: "AVAILABLE", updated: 0, amenities: ["24/7 power", "Fitted kitchen", "CCTV"] },
  "p-008": { status: "PUBLISHED", availability: "OFF_MARKET", updated: 12, amenities: ["24/7 power", "Parking", "CCTV"] },
  "p-009": { status: "DRAFT", availability: "AVAILABLE", updated: 0, amenities: ["Swimming pool", "Gated estate", "Boys' quarters"] },
  "p-010": { status: "PUBLISHED", availability: "AVAILABLE", updated: 0, amenities: ["24/7 power", "Fitted kitchen", "Gated estate", "Parking", "Air conditioning"] },
  "p-011": { status: "PUBLISHED", availability: "AVAILABLE", updated: 2, amenities: ["Good road access", "Fenced"] },
  "p-012": { status: "PUBLISHED", availability: "AVAILABLE", updated: 1, amenities: ["24/7 power", "Serviced", "Elevator", "Gym", "Swimming pool", "Air conditioning", "CCTV", "Parking"] },
};

type Details = {
  summary: string;
  description: string;
  toilets?: number;
  parkingSpaces?: number;
  floors?: number;
  yearBuilt?: number;
  furnishing?: Furnishing;
  serviceCharge?: number;
  isNegotiable?: boolean;
  /** Set to show the street address and map pin; otherwise only the area is public. */
  address?: { line1: string; lat: number; lng: number };
};

/** Copy and specs so the public property page has something to show. All fictional. */
const DETAILS: Record<string, Details> = {
  "p-001": {
    summary: "A five-bedroom detached house on a quiet close, with a pool, a boys' quarters and a C of O.",
    description:
      "Built in 2021 on a 1,000 sqm plot, the house sits at the end of a quiet close with a gated forecourt for four cars.\n\nDownstairs has a double-height living room that opens onto the pool terrace, a family lounge, a guest room and a kitchen with a separate laundry. Upstairs are four en-suite bedrooms, including a main suite with a dressing room and a balcony over the pool.\n\nThe estate has round-the-clock security and its own power plant. A two-room boys' quarters sits behind the house.",
    toilets: 7,
    parkingSpaces: 4,
    floors: 2,
    yearBuilt: 2021,
    furnishing: "UNFURNISHED",
    isNegotiable: true,
  },
  "p-002": {
    summary: "A four-bedroom semi-detached duplex a short drive from Admiralty Way.",
    description:
      "All four bedrooms are en-suite, with the main bedroom taking the whole back of the first floor. The ground floor has a through lounge, a guest toilet and a fitted kitchen with a store.\n\nThe estate is paved, gated and has a shared generator. There's parking for two cars inside the compound.",
    toilets: 5,
    parkingSpaces: 2,
    floors: 2,
    yearBuilt: 2019,
    furnishing: "SEMI_FURNISHED",
    serviceCharge: 1_200_000,
  },
  "p-003": {
    summary: "Two dry, fenced plots in a growing estate off the Lekki–Epe Expressway.",
    description:
      "Two adjoining plots (about 1,296 sqm in total) on dry, level land. The estate road is graded and the plots are fenced on three sides.\n\nThe land sits about ten minutes from the expressway, close to the free trade zone. You can buy one plot or both.",
    isNegotiable: true,
  },
  "p-004": {
    summary: "A serviced three-bedroom flat with steady power and water, on a quiet street.",
    description:
      "A second-floor flat in a block of six. The rent includes a shared generator, a borehole and cleaning of the common areas.\n\nThere's a large lounge and dining area, a fitted kitchen, and three bedrooms (two en-suite). One parking space comes with the flat.",
    toilets: 4,
    parkingSpaces: 1,
    floors: 1,
    yearBuilt: 2017,
    furnishing: "SEMI_FURNISHED",
    serviceCharge: 600_000,
    address: { line1: "12 Third Avenue", lat: 9.1099, lng: 7.4042 },
  },
  "p-005": {
    summary: "A three-bedroom bungalow on a full plot in a gated estate.",
    description:
      "A finished three-bedroom bungalow on a 648 sqm plot, with space at the back to extend. All rooms are en-suite.\n\nThe estate is gated with a borehole for each house.",
    toilets: 4,
    parkingSpaces: 3,
    floors: 1,
    yearBuilt: 2022,
    furnishing: "UNFURNISHED",
  },
  "p-006": {
    summary: "A one-bedroom mini flat a short walk from the University of Lagos.",
    description:
      "A ground-floor mini flat with a lounge, one bedroom, a kitchen and a bathroom. Water comes from a borehole in the compound.\n\nRent is paid yearly. Suits a student or a young professional.",
    toilets: 1,
    floors: 1,
    furnishing: "UNFURNISHED",
  },
  "p-007": {
    summary: "A furnished two-bedroom short-let near the beach, with Wi-Fi and steady power.",
    description: "Fully furnished and cleaned between stays, with Wi-Fi and round-the-clock power.",
    toilets: 3,
    parkingSpaces: 1,
    furnishing: "FURNISHED",
  },
  "p-008": {
    summary: "A 240 sqm open-plan office floor on Adeola Odeku, with lifts and backup power.",
    description:
      "An open floor with glass walls on two sides, two toilets and a small kitchenette. The building has two lifts, a backup generator and a reception desk.\n\nThe floor is let as a shell, so you can fit it out your way. Leases start at two years.",
    toilets: 2,
    parkingSpaces: 4,
    serviceCharge: 4_000_000,
    address: { line1: "Plot 8, Adeola Odeku Street", lat: 6.4311, lng: 3.4216 },
  },
  "p-009": {
    summary: "A five-bedroom duplex on 1,500 sqm with a garden pool.",
    description: "A five-bedroom duplex in a mature garden, with a pool, a gatehouse and a boys' quarters.",
    toilets: 7,
    parkingSpaces: 5,
    floors: 2,
    yearBuilt: 2015,
  },
  "p-010": {
    summary: "A four-bedroom terrace with a rooftop terrace, in a gated estate in Ikate.",
    description:
      "One of eight terraces in a new gated estate. The ground floor has a lounge, a guest toilet and a fitted kitchen. Three bedrooms are on the first floor, and the main bedroom has the second floor to itself, opening onto a rooftop terrace.\n\nEvery room has air conditioning. The estate has a shared power plant and parking for two cars per house.",
    toilets: 5,
    parkingSpaces: 2,
    floors: 3,
    yearBuilt: 2025,
    furnishing: "UNFURNISHED",
    serviceCharge: 1_500_000,
  },
  "p-011": {
    summary: "A 600 sqm residential plot in Guzape with a C of O, ready to build on.",
    description:
      "A gently sloping plot on a tarred road, with views across the city from the top of the site. The plot is fenced and the survey is registered.\n\nPower and water connections run along the road.",
    isNegotiable: true,
  },
  "p-012": {
    summary: "A serviced three-bedroom penthouse with lagoon views, a gym and a pool.",
    description:
      "The top floor of a twelve-storey building, with a wraparound balcony facing the lagoon. There's a large lounge and dining room, a fitted kitchen, a study and three en-suite bedrooms.\n\nThe service charge covers power, water, lifts, the gym, the pool and security.",
    toilets: 4,
    parkingSpaces: 2,
    floors: 1,
    yearBuilt: 2023,
    furnishing: "FURNISHED",
    serviceCharge: 8_000_000,
  },
};


const INQUIRIES: { property: string; name: string; type: InquiryType; status: InquiryStatus; hoursAgo: number; message: string }[] = [
  { property: "5-bedroom-detached-duplex-banana-island", name: "Chidinma Okafor", type: "VIEWING_REQUEST", status: "NEW", hoursAgo: 2, message: "Can I view this on Saturday morning?" },
  { property: "2-plots-residential-land-ibeju-lekki", name: "Tunde Bakare", type: "GENERAL", status: "NEW", hoursAgo: 5, message: "Is the C of O for both plots together or separate?" },
  { property: "4-bedroom-semi-detached-duplex-lekki-phase-1", name: "Aisha Bello", type: "OFFER", status: "IN_PROGRESS", hoursAgo: 26, message: "I'd like to offer ₦175,000,000. Is the seller open to it?" },
  { property: "mini-flat-yaba", name: "Emeka Nwosu", type: "VIEWING_REQUEST", status: "NEW", hoursAgo: 30, message: "Is it still available from next month?" },
  { property: "3-bedroom-apartment-gwarinpa", name: "Fatima Sani", type: "GENERAL", status: "CLOSED", hoursAgo: 80, message: "Does the rent include the service charge?" },
  { property: "2-plots-residential-land-ibeju-lekki", name: "Segun Adeyemi", type: "VIEWING_REQUEST", status: "IN_PROGRESS", hoursAgo: 100, message: "Please share the survey plan before the inspection." },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log(`Seeding branch: ${branch ?? "(unknown)"}`);

  const amenityIds = new Map<string, number>();
  for (const a of AMENITIES) {
    const row = await prisma.amenity.upsert({
      where: { slug: slugify(a.name) },
      update: { name: a.name, group: a.group },
      create: { name: a.name, slug: slugify(a.name), group: a.group },
    });
    amenityIds.set(a.name, row.id);
  }

  const propertyIds = new Map<string, string>();
  for (const p of DUMMY_PROPERTIES) {
    const state = STATE[p.id];
    const details = DETAILS[p.id];
    const data = {
      name: p.name,
      summary: details.summary,
      description: details.description,
      category: p.category,
      type: p.type,
      listingType: p.listingType,
      status: state.status,
      availability: state.availability,
      isFeatured: p.isFeatured,
      price: p.price === null ? null : String(p.price),
      currency: p.currency,
      pricePeriod: p.pricePeriod,
      landSize: p.landSize,
      landSizeUnit: p.landSizeUnit,
      landAreaSqm: p.landSize && p.landSizeUnit === "PLOT" ? p.landSize * 648 : p.landSizeUnit === "SQM" ? p.landSize : null,
      floorAreaSqm: p.floorAreaSqm,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      country: "NG",
      titleType: p.titleType,
      toilets: details.toilets ?? null,
      parkingSpaces: details.parkingSpaces ?? null,
      floors: details.floors ?? null,
      yearBuilt: details.yearBuilt ?? null,
      furnishing: details.furnishing ?? null,
      serviceCharge: details.serviceCharge === undefined ? null : String(details.serviceCharge),
      isNegotiable: details.isNegotiable ?? false,
      addressLine1: details.address?.line1 ?? null,
      latitude: details.address ? String(details.address.lat) : null,
      longitude: details.address ? String(details.address.lng) : null,
      showExactAddress: Boolean(details.address),
      publishedAt: state.status === "PUBLISHED" ? daysAgo(state.updated + 5) : null,
      updatedAt: daysAgo(state.updated, 3),
      deletedAt: null,
    };
    const row = await prisma.property.upsert({ where: { slug: p.slug }, update: data, create: { ...data, slug: p.slug } });
    propertyIds.set(p.slug, row.id);

    await prisma.propertyMedia.deleteMany({ where: { propertyId: row.id } });
    // Cover first, then the gallery. Seed keys never exist in R2, so deleting them from the admin is harmless.
    const photos = [p.coverImage, ...(SEED_GALLERY[p.id] ?? [])];
    await prisma.propertyMedia.createMany({
      data: photos.map((photo, i) => ({
        propertyId: row.id,
        url: photo.url,
        storageKey: `seed/${p.slug}-${i + 1}.jpg`,
        altText: photo.alt,
        sortOrder: i,
        isCover: i === 0,
      })),
    });

    await prisma.propertyAmenity.deleteMany({ where: { propertyId: row.id } });
    await prisma.propertyAmenity.createMany({
      data: state.amenities.map((name) => ({ propertyId: row.id, amenityId: amenityIds.get(name)! })),
    });
  }

  await prisma.inquiry.deleteMany({ where: { email: { endsWith: SEED_EMAIL_DOMAIN } } });
  await prisma.inquiry.createMany({
    data: INQUIRIES.map((q) => ({
      propertyId: propertyIds.get(q.property) ?? null,
      name: q.name,
      email: `${slugify(q.name)}${SEED_EMAIL_DOMAIN}`,
      type: q.type,
      status: q.status,
      message: q.message,
      createdAt: new Date(Date.now() - q.hoursAgo * 60 * 60 * 1000),
    })),
  });

  const [properties, inquiries] = await Promise.all([prisma.property.count(), prisma.inquiry.count()]);
  console.log(`Done: ${AMENITIES.length} amenities, ${properties} properties, ${inquiries} enquiries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
