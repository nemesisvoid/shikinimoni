import { cn } from '@/lib/utils';

/**
 * The logo's house with its two roof strokes drawing in, and a short label
 * where the door would be ("404", "!"). Decorative: pages say the same in text.
 */
export function NotFoundIllustration({ className, label = '404' }: { className?: string; label?: string }) {
  const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1, strokeDasharray: 1 } as const;
  return (
    <svg
      viewBox='-12 0 124 112'
      aria-hidden='true'
      className={cn('overflow-visible', className)}>
      <polygon
        points='50,16 100,40 100,104 0,104 0,40'
        fill='var(--color-plum-100)'
        className='motion-safe:animate-rise'
      />
      <path
        {...stroke}
        d='M -8.5 28.7 L 28 6.8 L 43.5 15.5'
        stroke='var(--color-azure-400)'
        strokeWidth={2.6}
        className='motion-safe:animate-roof-draw [animation-delay:250ms]'
      />
      <path
        {...stroke}
        d='M -3 44 L 50 12.2 L 103 44 Q 106 46 107.4 50.2'
        stroke='var(--color-sunset-400)'
        strokeWidth={2.8}
        className='motion-safe:animate-roof-draw [animation-delay:500ms]'
      />
      <text
        x='50'
        y='84'
        textAnchor='middle'
        fill='var(--color-plum-800)'
        style={{ font: '800 26px var(--font-heading)', letterSpacing: '-0.04em' }}>
        {label}
      </text>
    </svg>
  );
}
