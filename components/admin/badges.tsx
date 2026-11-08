import type { Availability, InquiryStatus, ListingStatus } from "@/lib/generated/prisma/enums";
import { AVAILABILITY_META, INQUIRY_STATUS_META, LISTING_STATUS_META } from "@/lib/admin/meta";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset";

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const meta = LISTING_STATUS_META[status];
  return <span className={cn(pill, meta.className)}>{meta.label}</span>;
}

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const meta = INQUIRY_STATUS_META[status];
  return <span className={cn(pill, meta.className)}>{meta.label}</span>;
}

/** Dot + label: same colours as the dashboard breakdown, never colour alone. */
export function AvailabilityLabel({ availability }: { availability: Availability }) {
  const meta = AVAILABILITY_META[availability];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}
