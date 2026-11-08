import type { Availability } from "@/lib/generated/prisma/enums";
import { AVAILABILITY_META, AVAILABILITY_ORDER } from "@/lib/admin/meta";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Part-to-whole beside its figures → thin segmented bar (8px, rounded, 2px surface
 * gaps, no text on the bar) above a list that names every part with its count and
 * share. The list is the always-visible table view; each segment also has a
 * hover/focus tooltip. Zero-count parts draw nothing.
 */
export function AvailabilityBreakdown({ counts }: { counts: Partial<Record<Availability, number>> }) {
  const rows = AVAILABILITY_ORDER.map((key) => ({ key, ...AVAILABILITY_META[key], count: counts[key] ?? 0 }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const share = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  if (total === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">Publish a listing to see how your stock is moving.</p>;
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex h-2 gap-0.5" role="group" aria-label={`${total} published listings by availability`}>
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <Tooltip key={r.key}>
              <TooltipTrigger
                render={
                  <span
                    tabIndex={0}
                    aria-label={`${r.label}: ${r.count} (${share(r.count)}%)`}
                    className="h-full min-w-2 rounded-full outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ flexGrow: r.count, flexBasis: 0, backgroundColor: r.color }}
                  />
                }
              />
              <TooltipContent>
                <span className="font-semibold tabular-nums">{r.count}</span> {r.label.toLowerCase()} ·{" "}
                <span className="tabular-nums">{share(r.count)}%</span>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>

      <ul className="mt-5 space-y-2.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: r.color }} />
            <span className="flex-1 text-foreground">{r.label}</span>
            <span className="w-8 text-right font-medium tabular-nums">{r.count}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">{share(r.count)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
