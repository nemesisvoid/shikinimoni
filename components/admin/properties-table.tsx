import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { AvailabilityLabel, ListingStatusBadge } from "@/components/admin/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ListingRow } from "@/lib/admin/queries";
import { formatPrice, formatRelativeTime } from "@/lib/format";

/**
 * `compact` (dashboard panel) drops Availability and Ref: the availability
 * breakdown sits beside it, and the panel is narrower than the full page.
 */
export function PropertiesTable({ rows, compact = false }: { rows: ListingRow[]; compact?: boolean }) {
  const now = Date.now();
  return (
    <Table className={compact ? "min-w-136" : "min-w-208"}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-5">Property</TableHead>
          <TableHead>Status</TableHead>
          {!compact && <TableHead>Availability</TableHead>}
          <TableHead className="text-right">Price</TableHead>
          {!compact && <TableHead className="text-right">Ref</TableHead>}
          <TableHead className="pr-5 text-right">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const cover = p.media[0];
          const { amount, suffix } = formatPrice(p.price === null ? null : Number(p.price), p.currency, p.pricePeriod);
          return (
            <TableRow key={p.id}>
              <TableCell className="py-3 pl-5">
                <div className="flex items-center gap-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {cover ? (
                      <Image src={cover.url} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <Building2 aria-hidden className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="block max-w-[18rem] truncate font-medium underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="max-w-[18rem] truncate text-xs text-muted-foreground">
                      {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <ListingStatusBadge status={p.status} />
              </TableCell>
              {!compact && (
                <TableCell className="text-sm">
                  <AvailabilityLabel availability={p.availability} />
                </TableCell>
              )}
              <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                {amount}
                {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
              </TableCell>
              {!compact && (
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  PRP-{String(p.refNumber).padStart(5, "0")}
                </TableCell>
              )}
              <TableCell className="pr-5 text-right text-sm whitespace-nowrap text-muted-foreground">
                <time dateTime={p.updatedAt.toISOString()}>{formatRelativeTime(p.updatedAt, now)}</time>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
