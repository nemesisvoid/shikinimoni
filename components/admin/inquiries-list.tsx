import { InquiryStatusBadge } from "@/components/admin/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INQUIRY_TYPE_LABEL } from "@/lib/admin/meta";
import type { InquiryRow } from "@/lib/admin/queries";
import { formatRelativeTime } from "@/lib/format";

/** Compact stacked list for the dashboard side panel. */
export function InquiriesList({ rows }: { rows: InquiryRow[] }) {
  const now = Date.now();
  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">No open enquiries. New ones from the site appear here.</p>;
  }
  return (
    <ul className="divide-y border-t">
      {rows.map((q) => (
        <li key={q.id} className="px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{q.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {INQUIRY_TYPE_LABEL[q.type]}
                {q.property && <> for {q.property.name}</>}
              </p>
            </div>
            <InquiryStatusBadge status={q.status} />
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm text-ink-700">{q.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={q.createdAt.toISOString()}>{formatRelativeTime(q.createdAt, now)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Full table for the enquiries page. */
export function InquiriesTable({ rows }: { rows: InquiryRow[] }) {
  const now = Date.now();
  return (
    <Table className="min-w-[48rem]">
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
          <TableRow key={q.id}>
            <TableCell className="py-3 pl-5">
              <p className="font-medium">{q.name}</p>
              <p className="text-xs text-muted-foreground">{q.email}</p>
            </TableCell>
            <TableCell>
              <p className="text-sm">{INQUIRY_TYPE_LABEL[q.type]}</p>
              <p className="max-w-[14rem] truncate text-xs text-muted-foreground">{q.property?.name ?? "General enquiry"}</p>
            </TableCell>
            <TableCell className="max-w-[22rem]">
              <p className="line-clamp-2 text-sm whitespace-normal text-ink-700">{q.message}</p>
            </TableCell>
            <TableCell>
              <InquiryStatusBadge status={q.status} />
            </TableCell>
            <TableCell className="pr-5 text-right text-sm whitespace-nowrap text-muted-foreground">
              <time dateTime={q.createdAt.toISOString()}>{formatRelativeTime(q.createdAt, now)}</time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
