import { cn } from "@/lib/utils";

/**
 * The two roof strokes from the logo (azure behind, sunset in front), drawn in
 * a -10..110 × 0..120 box so they overhang a 100 × 120 house by 10 units each side.
 * `animated` draws them in once on load (see --animate-roof-draw in globals.css).
 */
export function Roofline({ className, animated = false }: { className?: string; animated?: boolean }) {
  const stroke = {
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pathLength: 1,
    strokeDasharray: 1,
  } as const;

  return (
    <svg viewBox="-10 0 120 120" aria-hidden="true" className={cn("overflow-visible", className)}>
      <path
        {...stroke}
        d="M -8.5 26.7 L 28 4.8 L 43.5 13.5"
        stroke="var(--color-azure-400)"
        strokeWidth={2.6}
        className={cn(animated && "motion-safe:animate-roof-draw [animation-delay:550ms]")}
      />
      <path
        {...stroke}
        d="M -3 42 L 50 10.2 L 103 42 Q 106 44 107.4 48.2"
        stroke="var(--color-sunset-400)"
        strokeWidth={2.8}
        className={cn(animated && "motion-safe:animate-roof-draw [animation-delay:800ms]")}
      />
    </svg>
  );
}
