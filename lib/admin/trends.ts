import "server-only";
import { prisma } from "@/lib/db";
import type { InquiryType } from "@/lib/generated/prisma/enums";

/**
 * Dashboard trends: enquiries and listing views over time, in Lagos time
 * (UTC+1 all year, no daylight saving). Callers must have checked admin access.
 */

export const TREND_RANGES = {
  "30d": { label: "30 days", unit: "day", count: 30, tickEvery: 7, previous: "the 30 days before" },
  "12w": { label: "12 weeks", unit: "week", count: 12, tickEvery: 3, previous: "the 12 weeks before" },
  "12m": { label: "12 months", unit: "month", count: 12, tickEvery: 3, previous: "the 12 months before" },
} as const;

export type TrendRange = keyof typeof TREND_RANGES;
type Unit = (typeof TREND_RANGES)[TrendRange]["unit"];

export function parseTrendRange(value: unknown): TrendRange {
  return typeof value === "string" && value in TREND_RANGES ? (value as TrendRange) : "30d";
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** A calendar date as midnight UTC, so date arithmetic never crosses a zone. */
const lagosToday = () => {
  const now = new Date(Date.now() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

function startOf(unit: Unit, date: Date) {
  if (unit === "day") return date;
  if (unit === "week") {
    const sinceMonday = (date.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - sinceMonday));
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shift(unit: Unit, date: Date, by: number) {
  const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  if (unit === "day") return new Date(Date.UTC(y, m, d + by));
  if (unit === "week") return new Date(Date.UTC(y, m, d + by * 7));
  return new Date(Date.UTC(y, m + by, 1));
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const dayMonth = fmt({ day: "numeric", month: "short" });
const weekdayDayMonth = fmt({ weekday: "short", day: "numeric", month: "short" });
const monthYear = fmt({ month: "long", year: "numeric" });
const shortMonth = fmt({ month: "short" });
const longDate = fmt({ day: "numeric", month: "long", year: "numeric" });

export type TrendBucket = {
  key: string;
  /** Tooltip and table label, e.g. "Week of 10 Nov". */
  label: string;
  /** Axis label, e.g. "10 Nov". */
  tick: string;
  /** The current day, week or month, which isn't over yet. */
  partial: boolean;
  enquiries: number;
  views: number;
};

function labelFor(unit: Unit, start: Date) {
  if (unit === "day") return { label: weekdayDayMonth.format(start), tick: dayMonth.format(start) };
  if (unit === "week") return { label: `Week of ${dayMonth.format(start)}`, tick: dayMonth.format(start) };
  return { label: monthYear.format(start), tick: shortMonth.format(start) };
}

export async function getDashboardTrends(range: TrendRange) {
  const { unit, count } = TREND_RANGES[range];
  const current = startOf(unit, lagosToday());
  const first = shift(unit, current, -(count - 1));
  // One extra period before the window, for the "compared with" figures.
  const previousFirst = shift(unit, first, -count);
  const sinceUtc = new Date(previousFirst.getTime() - LAGOS_OFFSET_MS);

  const [enquiryRows, viewRows, byType, topViewed, firstViewDay] = await Promise.all([
    prisma.$queryRaw<{ bucket: Date; n: number }[]>`
      SELECT date_trunc(${unit}, "createdAt" AT TIME ZONE 'Africa/Lagos')::date AS bucket, count(*)::int AS n
      FROM "inquiries"
      WHERE "createdAt" >= ${sinceUtc} AND "status" <> 'SPAM'
      GROUP BY 1`,
    prisma.$queryRaw<{ bucket: Date; n: number }[]>`
      SELECT date_trunc(${unit}, "day"::timestamp)::date AS bucket, sum("views")::int AS n
      FROM "property_view_days"
      WHERE "day" >= ${isoDay(previousFirst)}::date
      GROUP BY 1`,
    prisma.inquiry.groupBy({
      by: ["type"],
      where: { createdAt: { gte: new Date(first.getTime() - LAGOS_OFFSET_MS) }, status: { not: "SPAM" } },
      _count: { _all: true },
    }),
    prisma.propertyViewDay.groupBy({
      by: ["propertyId"],
      where: { day: { gte: first } },
      _sum: { views: true },
      orderBy: { _sum: { views: "desc" } },
      take: 5,
    }),
    prisma.propertyViewDay.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
  ]);

  const toMap = (rows: { bucket: Date; n: number }[]) => new Map(rows.map((r) => [isoDay(r.bucket), r.n]));
  const enquiries = toMap(enquiryRows);
  const views = toMap(viewRows);

  const buckets: TrendBucket[] = [];
  let previousEnquiries = 0;
  let previousViews = 0;
  for (let i = 0; i < count * 2; i++) {
    const start = shift(unit, previousFirst, i);
    const key = isoDay(start);
    if (i < count) {
      previousEnquiries += enquiries.get(key) ?? 0;
      previousViews += views.get(key) ?? 0;
      continue;
    }
    buckets.push({
      key,
      ...labelFor(unit, start),
      partial: i === count * 2 - 1,
      enquiries: enquiries.get(key) ?? 0,
      views: views.get(key) ?? 0,
    });
  }

  const topListings = await describeTopListings(
    topViewed.map((r) => ({ id: r.propertyId, views: r._sum.views ?? 0 })),
    new Date(first.getTime() - LAGOS_OFFSET_MS),
  );

  const typeCounts: Record<InquiryType, number> = { GENERAL: 0, VIEWING_REQUEST: 0, OFFER: 0 };
  for (const row of byType) typeCounts[row.type] = row._count._all;

  // Views have only been counted since tracking went live; say so rather than show a false drop.
  const countingSince = firstViewDay && firstViewDay.day > previousFirst ? longDate.format(firstViewDay.day) : null;

  return {
    range,
    buckets,
    totals: {
      enquiries: buckets.reduce((sum, b) => sum + b.enquiries, 0),
      views: buckets.reduce((sum, b) => sum + b.views, 0),
      previousEnquiries,
      previousViews,
    },
    enquiriesByType: typeCounts,
    topListings,
    countingSince,
    noViewsYet: !firstViewDay,
  };
}

/** Names and enquiry counts (same window, spam excluded) for the most viewed listings. */
async function describeTopListings(rows: { id: string; views: number }[], sinceUtc: Date) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [properties, enquiryCounts] = await Promise.all([
    prisma.property.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, refNumber: true, status: true, deletedAt: true, neighborhood: true, city: true },
    }),
    prisma.inquiry.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids }, createdAt: { gte: sinceUtc }, status: { not: "SPAM" } },
      _count: { _all: true },
    }),
  ]);
  return rows.flatMap((row) => {
    const property = properties.find((p) => p.id === row.id);
    if (!property) return [];
    const enquiries = enquiryCounts.find((e) => e.propertyId === row.id)?._count._all ?? 0;
    return [{ ...property, views: row.views, enquiries }];
  });
}

export type DashboardTrends = Awaited<ReturnType<typeof getDashboardTrends>>;
