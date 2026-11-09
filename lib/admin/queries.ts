import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Availability, ListingStatus } from "@/lib/generated/prisma/enums";
import type { PropertyFilters, PropertySort } from "@/schemas/property.schema";

/**
 * Admin read queries. Callers must have checked admin access already
 * (requireAdminPage / assertAdmin). Selects only the columns each view shows.
 */

const live = { deletedAt: null } as const;

const listingRowSelect = {
  id: true,
  refNumber: true,
  slug: true,
  name: true,
  status: true,
  availability: true,
  listingType: true,
  price: true,
  currency: true,
  pricePeriod: true,
  neighborhood: true,
  city: true,
  state: true,
  updatedAt: true,
  media: { where: { isCover: true }, take: 1, select: { url: true, altText: true } },
} as const;

const inquiryRowSelect = {
  id: true,
  name: true,
  email: true,
  type: true,
  status: true,
  message: true,
  createdAt: true,
  property: { select: { name: true, slug: true } },
} as const;

export async function getDashboardData() {
  const [byStatus, byAvailability, featured, inquiriesByStatus, recentListings, recentInquiries] = await Promise.all([
    prisma.property.groupBy({ by: ["status"], where: live, _count: { _all: true } }),
    prisma.property.groupBy({
      by: ["availability"],
      where: { ...live, status: "PUBLISHED" },
      _count: { _all: true },
    }),
    prisma.property.count({ where: { ...live, status: "PUBLISHED", isFeatured: true } }),
    prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.property.findMany({ where: live, orderBy: { updatedAt: "desc" }, take: 6, select: listingRowSelect }),
    prisma.inquiry.findMany({
      where: { status: { in: ["NEW", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: inquiryRowSelect,
    }),
  ]);

  const statusCount = (s: ListingStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const availabilityCounts = Object.fromEntries(byAvailability.map((r) => [r.availability, r._count._all])) as Partial<
    Record<Availability, number>
  >;
  const inquiryCount = (s: string) => inquiriesByStatus.find((r) => r.status === s)?._count._all ?? 0;

  return {
    published: statusCount("PUBLISHED"),
    drafts: statusCount("DRAFT"),
    featured,
    closedDeals: (availabilityCounts.SOLD ?? 0) + (availabilityCounts.RENTED ?? 0),
    underOffer: availabilityCounts.UNDER_OFFER ?? 0,
    availabilityCounts,
    newInquiries: inquiryCount("NEW"),
    inProgressInquiries: inquiryCount("IN_PROGRESS"),
    recentListings,
    recentInquiries,
  };
}

const SORT_ORDER: Record<PropertySort, Prisma.PropertyOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  updated: [{ updatedAt: "desc" }],
  updated_asc: [{ updatedAt: "asc" }],
  // "Price on request" (null) sorts last either way.
  price_asc: [{ price: { sort: "asc", nulls: "last" } }],
  price_desc: [{ price: { sort: "desc", nulls: "last" } }],
  name_asc: [{ name: "asc" }],
  name_desc: [{ name: "desc" }],
};

/**
 * One page of the admin properties table. Search matches the name, area, city,
 * state or web address, and a reference like "PRP-00012" or "12". A page past
 * the end falls back to the last page.
 */
export async function listAdminPropertiesPage(filters: PropertyFilters) {
  const q = filters.q?.trim();
  const refMatch = q?.match(/^(?:prp-?)?0*(\d{1,9})$/i);
  const where: Prisma.PropertyWhereInput = {
    ...(filters.includeDeleted ? {} : live),
    status: filters.status,
    listingType: filters.listingType,
    category: filters.category,
    type: filters.type,
    availability: filters.availability,
    ...(filters.featured !== undefined ? { isFeatured: filters.featured } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { neighborhood: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { state: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            ...(refMatch ? [{ refNumber: Number(refMatch[1]) }] : []),
          ],
        }
      : {}),
  };

  const total = await prisma.property.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const rows = await prisma.property.findMany({
    where,
    orderBy: [...SORT_ORDER[filters.sort], { id: "desc" }], // id breaks ties so pages never overlap
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
    select: { ...listingRowSelect, category: true, isFeatured: true },
  });
  return { rows, total, page, pageCount };
}

/** Everything the edit form needs. Null for a missing or deleted property. */
export async function getPropertyForEdit(id: string) {
  const property = await prisma.property.findFirst({
    where: { id, ...live },
    include: {
      amenities: { select: { amenityId: true } },
      media: {
        where: { type: "IMAGE" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, url: true, altText: true, isCover: true },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, type: true, isPublic: true, mimeType: true, sizeBytes: true },
      },
    },
  });
  if (!property) return null;
  // The form treats the first photo as the cover, so make sure it is first.
  const media = [...property.media].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  return { ...property, media };
}

export function listInquiries() {
  return prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: inquiryRowSelect });
}

export function listAmenities() {
  return prisma.amenity.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, group: true, _count: { select: { properties: true } } },
  });
}

export function countNewInquiries() {
  return prisma.inquiry.count({ where: { status: "NEW" } });
}

export type ListingRow = Prisma.PropertyGetPayload<{ select: typeof listingRowSelect }>;
export type InquiryRow = Awaited<ReturnType<typeof listInquiries>>[number];
