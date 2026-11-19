import type { InquiryStatus } from "@/lib/generated/prisma/enums";

/**
 * Tabs on the enquiries page (?view=…). "Open" is the working queue: new ones
 * plus those someone is handling. Shared by the page (server) and links.
 */
export const INQUIRY_VIEWS = {
  open: { label: "Open", statuses: ["NEW", "IN_PROGRESS"] },
  new: { label: "New", statuses: ["NEW"] },
  in_progress: { label: "In progress", statuses: ["IN_PROGRESS"] },
  closed: { label: "Closed", statuses: ["CLOSED"] },
  spam: { label: "Spam", statuses: ["SPAM"] },
  all: { label: "All", statuses: null },
} as const satisfies Record<string, { label: string; statuses: readonly InquiryStatus[] | null }>;

export type InquiryView = keyof typeof INQUIRY_VIEWS;
export const DEFAULT_INQUIRY_VIEW: InquiryView = "open";

export function parseInquiryView(value: unknown): InquiryView {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v in INQUIRY_VIEWS ? (v as InquiryView) : DEFAULT_INQUIRY_VIEW;
}

export function inquiryViewHref(view: InquiryView) {
  return view === DEFAULT_INQUIRY_VIEW ? "/admin/inquiries" : `/admin/inquiries?view=${view}`;
}

/** What each status means, for the handling form. */
export const INQUIRY_STATUS_HINT: Record<InquiryStatus, string> = {
  NEW: "Nobody has picked it up yet",
  IN_PROGRESS: "Someone is replying or arranging a viewing",
  CLOSED: "Answered or done; nothing left to do",
  SPAM: "Junk. Hidden from the open list",
};
