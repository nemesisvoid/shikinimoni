import { Roofline } from '@/components/landing/roofline';
import { cn } from '@/lib/utils';

/** Stands in for a listing with no photos yet: the logo's roof over a soft plum field. */
export function PhotoPlaceholder({ className, label = 'Photos coming soon' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 bg-plum-50 text-plum-700', className)}>
      <Roofline className='w-20 opacity-80' />
      <span className='text-sm font-medium'>{label}</span>
    </div>
  );
}
