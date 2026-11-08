import type { ListingType, PricePeriod, SizeUnit } from "@/lib/generated/prisma/enums";

const PERIOD_SUFFIX: Record<PricePeriod, string> = {
  TOTAL: "",
  PER_YEAR: "/year",
  PER_MONTH: "/month",
  PER_WEEK: "/week",
  PER_NIGHT: "/night",
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** "₦25,000,000" plus a separate period suffix ("/year") for styling. */
export function formatPrice(price: number | null, currency: string, period: PricePeriod) {
  if (price === null) return { amount: "Price on request", suffix: "" };
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }
  return { amount: formatter.format(price), suffix: PERIOD_SUFFIX[period] };
}

const UNIT_LABEL: Record<SizeUnit, [singular: string, plural: string]> = {
  SQM: ["sqm", "sqm"],
  SQFT: ["sq ft", "sq ft"],
  PLOT: ["plot", "plots"],
  ACRE: ["acre", "acres"],
  HECTARE: ["hectare", "hectares"],
};

export function formatSize(value: number, unit: SizeUnit) {
  const [one, many] = UNIT_LABEL[unit];
  return `${value.toLocaleString("en-NG")} ${value === 1 ? one : many}`;
}

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFormatter = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** "2 hours ago", "yesterday"; falls back to a date after 30 days. */
export function formatRelativeTime(date: Date, now = Date.now()) {
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return relativeFormatter.format(Math.round(seconds / 86_400), "day");
  return dateFormatter.format(date);
}

/** Compact figures for stat tiles: 1,284 / 12.9K / 4.2M. */
export function formatCompactNumber(n: number) {
  return n < 10_000 ? n.toLocaleString("en-NG") : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  SALE: "For sale",
  RENT: "For rent",
  LEASE: "For lease",
  SHORT_LET: "Short let",
};

/** Two-letter avatar fallback: "Ada Lovelace" -> "AL", "ada@x.com" -> "AX". */
export function initialsFor(name: string | null | undefined, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
