import "server-only";
import { prisma } from "@/lib/db";
import type { Availability, ListingStatus } from "@/lib/generated/prisma/enums";

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

export function listAdminProperties() {
  return prisma.property.findMany({ where: live, orderBy: { updatedAt: "desc" }, take: 100, select: listingRowSelect });
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

export type ListingRow = Awaited<ReturnType<typeof listAdminProperties>>[number];
export type InquiryRow = Awaited<ReturnType<typeof listInquiries>>[number];
