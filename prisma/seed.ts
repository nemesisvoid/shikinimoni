/**
 * Development seed: the landing page's dummy listings, plus amenities and enquiries,
 * so the admin dashboard has realistic data. Safe to re-run (upserts by slug;
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
import { DUMMY_PROPERTIES } from "../lib/data/dummy-properties";

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
    const data = {
      name: p.name,
      description: `${p.name} in ${[p.neighborhood, p.city].filter(Boolean).join(", ")}. Placeholder description for development.`,
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
      publishedAt: state.status === "PUBLISHED" ? daysAgo(state.updated + 5) : null,
      updatedAt: daysAgo(state.updated, 3),
      deletedAt: null,
    };
    const row = await prisma.property.upsert({ where: { slug: p.slug }, update: data, create: { ...data, slug: p.slug } });
    propertyIds.set(p.slug, row.id);

    await prisma.propertyMedia.deleteMany({ where: { propertyId: row.id } });
    await prisma.propertyMedia.create({
      data: { propertyId: row.id, url: p.coverImage.url, storageKey: `seed/${p.slug}.jpg`, altText: p.coverImage.alt, isCover: true },
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
