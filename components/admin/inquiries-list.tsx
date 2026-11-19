import Link from "next/link";
import { InquiryStatusBadge } from "@/components/admin/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INQUIRY_TYPE_LABEL } from "@/lib/admin/meta";
import type { InquiryRow } from "@/lib/admin/queries";
import { formatRelativeTime } from "@/lib/format";

const inquiryHref = (id: string) => `/admin/inquiries/${id}`;

/** Compact stacked list for the dashboard side panel. Each item opens the enquiry. */
export function InquiriesList({ rows }: { rows: InquiryRow[] }) {
  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">No open enquiries. New ones from the site appear here.</p>;
  }
  return (
    <ul className="divide-y border-t">
      {rows.map((q) => (
        <li key={q.id} className="relative px-5 py-3.5 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={inquiryHref(q.id)} className="block truncate text-sm font-medium after:absolute after:inset-0">
                {q.name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {q.property ? (
                  <>
                    {INQUIRY_TYPE_LABEL[q.type]} for {q.property.name}
                  </>
                ) : (
                  "Contact page message"
                )}
              </p>
            </div>
            <InquiryStatusBadge status={q.status} />
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm text-ink-700">{q.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={q.createdAt.toISOString()}>{formatRelativeTime(q.createdAt)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Full table for the enquiries page. The name opens the enquiry; the whole row is clickable. */
export function InquiriesTable({ rows }: { rows: InquiryRow[] }) {
  return (
    <Table className="min-w-3xl">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">From</TableHead>
          <TableHead>About</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="pr-5 text-right">Received</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((q) => (
          <TableRow key={q.id} className="relative">
            <TableCell className="py-3 pl-5">
              <Link
                href={inquiryHref(q.id)}
                className="font-medium underline-offset-4 after:absolute after:inset-0 hover:underline"
              >
                {q.name}
              </Link>
              <p className="text-xs text-muted-foreground">{q.email}</p>
            </TableCell>
            <TableCell>
              <p className="text-sm">{q.property ? INQUIRY_TYPE_LABEL[q.type] : "Contact page"}</p>
              <p className="max-w-56 truncate text-xs text-muted-foreground">{q.property?.name ?? "General enquiry"}</p>
            </TableCell>
            <TableCell className="max-w-88">
              <p className="line-clamp-2 text-sm whitespace-normal text-ink-700">{q.message}</p>
            </TableCell>
            <TableCell>
              <InquiryStatusBadge status={q.status} />
            </TableCell>
            <TableCell className="pr-5 text-right text-sm whitespace-nowrap text-muted-foreground">
              <time dateTime={q.createdAt.toISOString()}>{formatRelativeTime(q.createdAt)}</time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
