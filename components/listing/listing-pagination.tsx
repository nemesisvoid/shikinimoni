import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { listingSearchHref, type ListingSearch } from '@/lib/listings/search';
import { cn } from '@/lib/utils';

/** 1 … 4 5 [6] 7 8 … 20: the first, the last, and two either side of the current page. */
function pageList(page: number, pageCount: number) {
  const pages = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function ListingPagination({ search, page, pageCount }: { search: ListingSearch; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => listingSearchHref({ ...search, page: p });
  const edge = cn(buttonVariants({ variant: 'outline' }), 'gap-1.5');
  const disabled = 'pointer-events-none opacity-40';

  return (
    <nav
      aria-label='Pages'
      className='mt-12 flex flex-wrap items-center justify-center gap-2'>
      <Link
        href={href(page - 1)}
        aria-disabled={page === 1}
        tabIndex={page === 1 ? -1 : undefined}
        className={cn(edge, page === 1 && disabled)}>
        <ChevronLeft aria-hidden />
        Previous
      </Link>
      <ol className='flex items-center gap-1 max-sm:hidden'>
        {pageList(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li
              key={`gap-${i}`}
              aria-hidden
              className='px-1 text-muted-foreground'>
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  buttonVariants({ variant: p === page ? 'default' : 'ghost', size: 'icon' }),
                  'tabular-nums',
                )}>
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className='text-sm text-muted-foreground tabular-nums sm:hidden'>
        Page {page} of {pageCount}
      </p>
      <Link
        href={href(page + 1)}
        aria-disabled={page === pageCount}
        tabIndex={page === pageCount ? -1 : undefined}
        className={cn(edge, page === pageCount && disabled)}>
        Next
        <ChevronRight aria-hidden />
      </Link>
    </nav>
  );
}
