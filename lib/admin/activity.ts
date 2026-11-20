import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AuditAction } from "@/lib/generated/prisma/enums";
import { INQUIRY_STATUS_META, LISTING_STATUS_META } from "@/lib/admin/meta";
import {
  AVAILABILITY_LABEL,
  CATEGORY_OPTIONS,
  FURNISHING_LABEL,
  LISTING_TYPE_OPTIONS,
  PRICE_PERIOD_LABEL,
  PROPERTY_TYPE_LABEL,
  SIZE_UNIT_LABEL,
} from "@/lib/admin/property-options";

/**
 * The activity log: audit_logs rows turned into plain sentences
 * ("Ada published “3-bed flat in Lekki”"). Callers must have checked admin access.
 */

export const ACTIVITY_AREAS = {
  all: { label: "Everything", entityType: null },
  listings: { label: "Listings", entityType: "Property" },
  enquiries: { label: "Enquiries", entityType: "Inquiry" },
  amenities: { label: "Amenities", entityType: "Amenity" },
  team: { label: "Team and profiles", entityType: "User" },
  settings: { label: "Site settings", entityType: "SiteSettings" },
} as const;
export type ActivityArea = keyof typeof ACTIVITY_AREAS;

export const ACTIVITY_PAGE_SIZE = 40;

export type ActivityFilters = { area: ActivityArea; who?: string; property?: string; page: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseActivityFilters(params: Record<string, string | string[] | undefined>): ActivityFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const area = one(params.area);
  const who = one(params.who);
  const property = one(params.property);
  const page = Number(one(params.page));
  return {
    area: area && area in ACTIVITY_AREAS ? (area as ActivityArea) : "all",
    who: who && UUID.test(who) ? who : undefined,
    property: property && UUID.test(property) ? property : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The URL for a set of filters, leaving out defaults. */
export function activityHref(f: Partial<ActivityFilters>) {
  const q = new URLSearchParams();
  if (f.property) q.set("property", f.property);
  else if (f.area && f.area !== "all") q.set("area", f.area);
  if (f.who) q.set("who", f.who);
  if (f.page && f.page > 1) q.set("page", String(f.page));
  const s = q.toString();
  return s ? `/admin/activity?${s}` : "/admin/activity";
}

export type ActivityDetail = { label: string; from?: string; to?: string; note?: string };
export type ActivityEntry = {
  id: string;
  at: Date;
  actor: { id: string; name: string; email: string; image: string | null } | null;
  /** Read as: {actor} {before} {target} {after}. */
  before: string;
  target?: { label: string; href?: string };
  after?: string;
  details: ActivityDetail[];
};

export async function getActivity(filters: ActivityFilters) {
  const entityType = filters.property ? "Property" : ACTIVITY_AREAS[filters.area].entityType;
  const where: Prisma.AuditLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(filters.property ? { entityId: filters.property } : {}),
    ...(filters.who ? { actorId: filters.who } : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ACTIVITY_PAGE_SIZE,
    take: ACTIVITY_PAGE_SIZE,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      changes: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const names = await lookUpNames(rows);
  return { entries: rows.map((row) => describe(row, names)), total, page, pageCount };
}

/** Everyone who has done something, for the "who" filter. */
export async function listActivityActors() {
  const ids = await prisma.auditLog.findMany({
    where: { actorId: { not: null } },
    distinct: ["actorId"],
    select: { actorId: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: ids.map((r) => r.actorId!) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return users.map((u) => ({ id: u.id, label: u.name || u.email }));
}

export async function getPropertyName(id: string) {
  const p = await prisma.property.findUnique({ where: { id }, select: { name: true } });
  if (p) return p.name;
  // Removed for good: the name survives in the log (create, delete and rename rows carry it).
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "Property", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { changes: true },
  });
  for (const row of rows) {
    const name = (row.changes as { name?: unknown } | null)?.name;
    if (typeof name === "string") return name;
    if (isFromTo(name)) return String(name.to);
  }
  return null;
}

// ── Names for the things each row points at ────────────────────────────────

type Row = Awaited<ReturnType<typeof prisma.auditLog.findMany<{ select: { entityType: true; entityId: true; changes: true } }>>>[number];

async function lookUpNames(rows: Row[]) {
  const idsOf = (type: string) => [...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId))];
  const amenityIds = new Set<number>();
  for (const r of rows) {
    if (r.entityType === "Amenity") amenityIds.add(Number(r.entityId));
    const ids = (r.changes as { amenityIds?: { from?: unknown; to?: unknown } } | null)?.amenityIds;
    for (const list of [ids?.from, ids?.to]) if (Array.isArray(list)) list.forEach((id) => amenityIds.add(Number(id)));
  }

  const [properties, inquiries, amenities, users] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: idsOf("Property") } }, select: { id: true, name: true, deletedAt: true } }),
    prisma.inquiry.findMany({ where: { id: { in: idsOf("Inquiry") } }, select: { id: true, name: true, property: { select: { name: true } } } }),
    prisma.amenity.findMany({ where: { id: { in: [...amenityIds].filter(Number.isInteger) } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: idsOf("User") } }, select: { id: true, name: true, email: true } }),
  ]);
  return {
    property: new Map(properties.map((p) => [p.id, p])),
    inquiry: new Map(inquiries.map((i) => [i.id, i])),
    amenity: new Map(amenities.map((a) => [a.id, a.name])),
    user: new Map(users.map((u) => [u.id, u.name || u.email])),
  };
}
type Names = Awaited<ReturnType<typeof lookUpNames>>;

// ── Sentences ───────────────────────────────────────────────────────────────

type Changes = Record<string, unknown>;
type FromTo = { from: unknown; to: unknown };
const isFromTo = (v: unknown): v is FromTo => typeof v === "object" && v !== null && "from" in v && "to" in v;

function describe(
  row: Row & { id: string; action: AuditAction; createdAt: Date; actor: ActivityEntry["actor"] },
  names: Names,
): ActivityEntry {
  const changes = (row.changes ?? {}) as Changes;
  const base = { id: row.id, at: row.createdAt, actor: row.actor };
  switch (row.entityType) {
    case "Property":
      return { ...base, ...describeProperty(row.action, row.entityId, changes, names) };
    case "Inquiry":
      return { ...base, ...describeInquiry(row.action, row.entityId, changes, names) };
    case "Amenity":
      return { ...base, ...describeAmenity(row.action, Number(row.entityId), changes, names) };
    case "User":
      return { ...base, ...describeUser(row.entityId, row.actor?.id, changes, names) };
    case "SiteSettings":
      return {
        ...base,
        before: "updated the",
        target: { label: "site settings", href: "/admin/settings" },
        details: fieldDetails(changes, SETTINGS_FIELDS),
      };
    default:
      return { ...base, before: `${row.action.toLowerCase().replace("_", " ")} ${row.entityType}`, details: [] };
  }
}

type Described = Omit<ActivityEntry, "id" | "at" | "actor">;

function describeProperty(action: AuditAction, id: string, changes: Changes, names: Names): Described {
  const live = names.property.get(id);
  const label = live?.name ?? (typeof changes.name === "string" ? changes.name : isFromTo(changes.name) ? String(changes.name.to) : "a listing");
  const target = { label: `“${label}”`, href: live && !live.deletedAt ? `/admin/properties/${id}` : undefined };
  const status = isFromTo(changes.status) ? changes.status : null;
  const details = action === "UPDATE" || action === "PUBLISH" || action === "UNPUBLISH" ? fieldDetails(changes, PROPERTY_FIELDS, names) : [];

  switch (action) {
    case "CREATE":
      return { before: "added", target, after: changes.status === "PUBLISHED" ? "and published it" : "as a draft", details: [] };
    case "PUBLISH":
      return { before: "published", target, details: details.filter((d) => d.label !== "Status") };
    case "UNPUBLISH":
      return {
        before: status?.to === "ARCHIVED" ? "archived" : "took",
        target,
        after: status?.to === "ARCHIVED" ? "(it’s off the site)" : "off the site",
        details: details.filter((d) => d.label !== "Status"),
      };
    case "STATUS_CHANGE":
      return status?.to === "ARCHIVED"
        ? { before: "archived", target, details: [] }
        : { before: "moved", target, after: `to ${statusLabel(status?.to)}`, details: [] };
    case "DELETE":
      return changes.permanent
        ? { before: "removed", target: { label: target.label }, after: "for good", details: [] }
        : { before: "deleted", target: { label: target.label }, details: [] };
    case "RESTORE":
      return { before: "restored", target, after: status?.to === "DRAFT" ? "as a draft" : undefined, details: [] };
    default:
      return { before: "edited", target, details };
  }
}

function describeInquiry(action: AuditAction, id: string, changes: Changes, names: Names): Described {
  const inquiry = names.inquiry.get(id);
  const who = inquiry?.name ? `${inquiry.name}’s enquiry` : "an enquiry";
  const target = { label: who, href: inquiry ? `/admin/inquiries/${id}` : undefined };
  const after = inquiry?.property?.name ? `about “${inquiry.property.name}”` : undefined;
  const notes = changes.adminNotes ? [{ label: "Notes", note: "updated" }] : [];
  if (isFromTo(changes.status)) {
    const to = INQUIRY_STATUS_META[changes.status.to as keyof typeof INQUIRY_STATUS_META]?.label.toLowerCase() ?? String(changes.status.to);
    return { before: "marked", target, after: `${after ? `${after} ` : ""}as ${to}`, details: notes };
  }
  return { before: "updated the notes on", target, after, details: [] };
}

function describeAmenity(action: AuditAction, id: number, changes: Changes, names: Names): Described {
  const current = names.amenity.get(id);
  const named = typeof changes.name === "string" ? changes.name : isFromTo(changes.name) ? String(changes.name.to) : current;
  const target = { label: `“${named ?? "an amenity"}”`, href: current ? "/admin/amenities" : undefined };
  if (action === "CREATE") return { before: "added the amenity", target, details: [] };
  if (action === "DELETE") {
    const n = Number(changes.listings) || 0;
    return { before: "deleted the amenity", target, after: n ? `(it was on ${n} ${n === 1 ? "listing" : "listings"})` : undefined, details: [] };
  }
  return { before: "edited the amenity", target, details: fieldDetails(changes, AMENITY_FIELDS) };
}

function describeUser(id: string, actorId: string | undefined, changes: Changes, names: Names): Described {
  const self = id === actorId;
  const label = names.user.get(id) ?? (typeof changes.email === "string" ? changes.email : "an account");
  const target = { label, href: "/admin/team" };
  if (isFromTo(changes.role)) {
    const nowAdmin = String(changes.role.to).split(",").some((r) => r.trim() === "admin");
    return nowAdmin ? { before: "made", target, after: "an admin", details: [] } : { before: "removed", target, after: "as an admin", details: [] };
  }
  if (changes.password) {
    return {
      before: self ? "changed their password" : "changed the password for",
      target: self ? undefined : target,
      after: changes.signedOutOtherDevices ? "and signed out their other devices" : undefined,
      details: [],
    };
  }
  if (isFromTo(changes.name)) {
    return self
      ? { before: `changed their name from “${text(changes.name.from)}” to “${text(changes.name.to)}”`, details: [] }
      : { before: "renamed", target, details: [{ label: "Name", from: text(changes.name.from), to: text(changes.name.to) }] };
  }
  return { before: "updated", target, details: [] };
}

// ── Field changes ───────────────────────────────────────────────────────────

type FieldSpec = { label: string; format?: (v: unknown, names?: Names) => string; long?: boolean };

const enumLabel = (map: Record<string, string | { label: string }>) => (v: unknown) => {
  const entry = map[String(v)];
  return entry === undefined ? text(v) : typeof entry === "string" ? entry : entry.label;
};
const statusLabel = (v: unknown) => enumLabel(LISTING_STATUS_META)(v).toLowerCase();
const yesNo = (v: unknown) => (v === true || v === "true" ? "Yes" : v === false || v === "false" ? "No" : text(v));
const number = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : Number(v).toLocaleString("en-NG"));

function text(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 77)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

const PROPERTY_FIELDS: Record<string, FieldSpec> = {
  name: { label: "Name" },
  slug: { label: "Web address" },
  summary: { label: "Summary", long: true },
  description: { label: "Description", long: true },
  category: { label: "Category", format: enumLabel(CATEGORY_OPTIONS) },
  type: { label: "Property type", format: enumLabel(PROPERTY_TYPE_LABEL) },
  listingType: { label: "Listed for", format: enumLabel(LISTING_TYPE_OPTIONS) },
  status: { label: "Status", format: enumLabel(LISTING_STATUS_META) },
  availability: { label: "Availability", format: enumLabel(AVAILABILITY_LABEL) },
  isFeatured: { label: "Featured", format: yesNo },
  price: { label: "Price", format: number },
  currency: { label: "Currency" },
  pricePeriod: { label: "Price is per", format: enumLabel(PRICE_PERIOD_LABEL) },
  isNegotiable: { label: "Negotiable", format: yesNo },
  serviceCharge: { label: "Service charge", format: number },
  landSize: { label: "Land size", format: number },
  landSizeUnit: { label: "Land size unit", format: enumLabel(SIZE_UNIT_LABEL) },
  landAreaSqm: { label: "Land area (sqm)", format: number },
  floorAreaSqm: { label: "Floor area (sqm)", format: number },
  bedrooms: { label: "Bedrooms", format: number },
  bathrooms: { label: "Bathrooms", format: number },
  toilets: { label: "Toilets", format: number },
  parkingSpaces: { label: "Parking spaces", format: number },
  floors: { label: "Floors", format: number },
  yearBuilt: { label: "Year built" },
  furnishing: { label: "Furnishing", format: enumLabel(FURNISHING_LABEL) },
  titleType: { label: "Title" },
  addressLine1: { label: "Address" },
  addressLine2: { label: "Address line 2" },
  neighborhood: { label: "Area" },
  city: { label: "City" },
  state: { label: "State" },
  country: { label: "Country" },
  postalCode: { label: "Postcode" },
  latitude: { label: "Map pin (latitude)" },
  longitude: { label: "Map pin (longitude)" },
  showExactAddress: { label: "Show exact address", format: yesNo },
};

const SETTINGS_FIELDS: Record<string, FieldSpec> = {
  contactEmail: { label: "Contact email" },
  phone: { label: "Phone" },
  whatsapp: { label: "WhatsApp" },
  officeAddress: { label: "Office address", format: (v) => text(String(v ?? "").replace(/\n/g, ", ")) },
  openingHours: {
    label: "Opening hours",
    format: (v) => (Array.isArray(v) && v.length ? v.map((h: { days?: string; time?: string }) => `${h.days} ${h.time}`).join("; ") : "empty"),
  },
  replyTime: { label: "Reply time" },
  alertEmails: { label: "Enquiry alerts go to" },
};

const AMENITY_FIELDS: Record<string, FieldSpec> = {
  name: { label: "Name" },
  group: { label: "Group" },
};

const humanise = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

function fieldDetails(changes: Changes, fields: Record<string, FieldSpec>, names?: Names): ActivityDetail[] {
  const details: ActivityDetail[] = [];
  for (const [key, value] of Object.entries(changes)) {
    if (key === "amenityIds" && isFromTo(value) && names) {
      const from = new Set((value.from as number[]) ?? []);
      const to = new Set((value.to as number[]) ?? []);
      const name = (id: number) => names.amenity.get(id) ?? "a removed amenity";
      const added = [...to].filter((id) => !from.has(id)).map(name);
      const removed = [...from].filter((id) => !to.has(id)).map(name);
      const note = [added.length && `added ${added.join(", ")}`, removed.length && `removed ${removed.join(", ")}`].filter(Boolean).join("; ");
      details.push({ label: "Amenities", note: note || "updated" });
      continue;
    }
    if (!isFromTo(value)) continue;
    const spec = fields[key] ?? { label: humanise(key) };
    if (spec.long) {
      details.push({ label: spec.label, note: "rewritten" });
      continue;
    }
    const format = spec.format ?? text;
    details.push({ label: spec.label, from: format(value.from, names), to: format(value.to, names) });
  }
  return details;
}
