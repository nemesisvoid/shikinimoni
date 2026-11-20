'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type TrendPoint = { key: string; label: string; tick: string; value: number; partial: boolean };

/** 0, then two more gridlines at round numbers that clear the tallest bar. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(max / 2)));
  for (const m of [1, 1.5, 2, 3, 5, 10]) {
    if (m * step * 2 >= max) return m * step * 2;
  }
  return max;
}

/**
 * One series over time as thin bars: 2px gaps, 4px rounded tops on the
 * baseline, recessive gridlines, sparse axis labels. Hovering a column (the
 * whole column, not just the bar) shows its figure. The period still in
 * progress is drawn lighter and says "so far". Screen readers get a table.
 */
export function TrendBars({
  points,
  color,
  noun,
  tickEvery,
  caption,
}: {
  points: TrendPoint[];
  /** A CSS colour for the bars. */
  color: string;
  /** Singular and plural, e.g. ['enquiry', 'enquiries']. */
  noun: [string, string];
  tickEvery: number;
  caption: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map(p => p.value)));
  const gridlines = [max, max / 2, 0];
  const count = (n: number) => `${n.toLocaleString('en-NG')} ${n === 1 ? noun[0] : noun[1]}`;
  // Ticks count back from the latest period, so "now" is always labelled.
  const showTick = (i: number) => (points.length - 1 - i) % tickEvery === 0;

  return (
    <figure className='m-0'>
      <div
        aria-hidden
        className='grid grid-cols-[auto_minmax(0,1fr)] gap-x-2'>
        {/* y axis */}
        <div className='relative h-36 w-7 text-right text-[11px] text-muted-foreground tabular-nums'>
          {gridlines.map(g => (
            <span
              key={g}
              className='absolute right-0 -translate-y-1/2 leading-none'
              style={{ top: `${100 - (g / max) * 100}%` }}>
              {g.toLocaleString('en-NG')}
            </span>
          ))}
        </div>

        {/* plot */}
        <div
          className='relative h-36'
          onMouseLeave={() => setActive(null)}>
          {gridlines.map(g => (
            <div
              key={g}
              className={cn('absolute inset-x-0 border-t', g === 0 ? 'border-foreground/25' : 'border-dashed border-border')}
              style={{ top: `${100 - (g / max) * 100}%` }}
            />
          ))}
          <div className='absolute inset-0 flex items-end gap-0.5'>
            {points.map((p, i) => {
              const height = (p.value / max) * 100;
              return (
                <div
                  key={p.key}
                  className='relative flex h-full flex-1 items-end'
                  onMouseEnter={() => setActive(i)}>
                  {active === i && <div className='absolute inset-0 rounded-t-md bg-muted/70' />}
                  {p.value > 0 && (
                    <div
                      className='relative w-full rounded-t-[4px]'
                      style={{
                        height: `max(${height}%, 3px)`,
                        backgroundColor: color,
                        opacity: p.partial ? 0.45 : active === null || active === i ? 1 : 0.7,
                      }}
                    />
                  )}
                  {active === i && (
                    <div
                      className={cn(
                        'pointer-events-none absolute bottom-full z-10 mb-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md',
                        i < points.length / 3 ? 'left-0' : i > (points.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                      )}>
                      <span className='block text-muted-foreground'>
                        {p.label}
                        {p.partial && ', so far'}
                      </span>
                      <span className='font-semibold tabular-nums'>{count(p.value)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* x axis */}
        <div />
        <div className='mt-1.5 flex gap-0.5 text-[11px] text-muted-foreground'>
          {points.map((p, i) => (
            <div
              key={p.key}
              className='relative h-4 flex-1'>
              {showTick(i) && (
                <span className={cn('absolute top-0 whitespace-nowrap', i === points.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2')}>
                  {p.tick}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <table className='sr-only'>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope='col'>Period</th>
            <th scope='col'>{noun[1]}</th>
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.key}>
              <th scope='row'>
                {p.label}
                {p.partial && ' (so far)'}
              </th>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
