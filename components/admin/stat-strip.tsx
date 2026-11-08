import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/format";

export type Stat = {
  label: string;
  value: number;
  context: string;
  href?: string;
  /** Draws the eye with a small sunset marker when the value is above zero. */
  needsAttention?: boolean;
};

/**
 * KPI row as one strip divided by hairlines (not four floating cards).
 * Stat-tile contract: sentence-case label, proportional figures for the value,
 * context line in muted ink. Linked stats use a full-cell overlay link so the
 * <dl> keeps valid <div><dt/><dd/></div> structure.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card lg:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "group relative p-5 transition-colors lg:p-6",
            stat.href && "hover:bg-muted/60 has-[a:focus-visible]:bg-muted/60",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i >= 1 && "lg:border-l",
          )}
        >
          <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {stat.label}
            {stat.needsAttention && stat.value > 0 && (
              <span className="size-2 rounded-full bg-highlight" role="img" aria-label="needs attention" />
            )}
          </dt>
          <dd className="mt-2 font-heading text-[2rem] leading-none font-extrabold tracking-tight">
            {formatCompactNumber(stat.value)}
          </dd>
          <dd className="mt-2 text-sm text-muted-foreground">{stat.context}</dd>
          {stat.href && (
            <Link href={stat.href} className="absolute inset-0 focus-visible:outline-none" aria-label={`${stat.label}: open`} />
          )}
        </div>
      ))}
    </dl>
  );
}
