import type { Availability, InquiryStatus, InquiryType, ListingStatus } from "@/lib/generated/prisma/enums";

/**
 * Availability is a categorical encoding used by the dashboard breakdown and the
 * table dots. Order is fixed (it's the segment order) and the four hues were
 * validated for colour-blind separation on the white card surface:
 *   azure-500 → sunset-400 → plum-700 → navy-600   (worst adjacent ΔE 10.0 deutan, 17.6 normal)
 * Off market uses the de-emphasis grey. Sunset is below 3:1 on white, so every use
 * must sit next to a text label (never colour alone).
 */
export const AVAILABILITY_META: Record<Availability, { label: string; color: string }> = {
  AVAILABLE: { label: "Available", color: "var(--color-azure-500)" },
  UNDER_OFFER: { label: "Under offer", color: "var(--color-sunset-400)" },
  SOLD: { label: "Sold", color: "var(--color-plum-700)" },
  RENTED: { label: "Rented", color: "var(--color-navy-600)" },
  OFF_MARKET: { label: "Off market", color: "var(--color-ink-300)" },
};
export const AVAILABILITY_ORDER: Availability[] = ["AVAILABLE", "UNDER_OFFER", "SOLD", "RENTED", "OFF_MARKET"];

/** Badges always carry a text label; colour only reinforces it. */
export const LISTING_STATUS_META: Record<ListingStatus, { label: string; className: string }> = {
  PUBLISHED: { label: "Published", className: "bg-plum-50 text-plum-800 ring-plum-200" },
  DRAFT: { label: "Draft", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  ARCHIVED: { label: "Archived", className: "bg-background text-muted-foreground ring-border" },
};

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-sunset-100 text-sunset-900 ring-sunset-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-azure-50 text-azure-800 ring-azure-200" },
  CLOSED: { label: "Closed", className: "bg-ink-100 text-ink-700 ring-ink-200" },
  SPAM: { label: "Spam", className: "bg-background text-muted-foreground ring-border line-through" },
};

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  GENERAL: "Question",
  VIEWING_REQUEST: "Viewing request",
  OFFER: "Offer",
};
