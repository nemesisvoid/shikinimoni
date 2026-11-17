'use client';

import { useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BED_OPTIONS,
  isFiltered,
  LISTING_KINDS,
  LISTING_SORTS,
  LISTINGS_PATH,
  listingSearchHref,
  MAX_PRICE_OPTIONS,
  parseListingSearch,
  type ListingKind,
  type ListingSearch,
} from '@/lib/listings/search';
import { cn } from '@/lib/utils';

/** ₦2.5m, ₦250m, ₦1bn: short enough for a select option. */
function shortNaira(n: number) {
  if (n >= 1_000_000_000) return `₦${n / 1_000_000_000}bn`;
  return `₦${n / 1_000_000}m`;
}

/**
 * The search bar for /properties. A plain GET form, so it works before
 * JavaScript loads; once it has, changes apply straight away without a reload
 * and the results dim while the next page loads.
 */
export function ListingFilters({
  search,
  states,
  children,
}: {
  search: ListingSearch;
  states: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const next = parseListingSearch(data);
    startTransition(() => router.push(listingSearchHref({ ...next, page: 1 }), { scroll: false }));
  }

  const submitOnChange = () => formRef.current && apply(formRef.current);

  return (
    <>
      <form
        // Remount when the URL changes (back button, "clear"), so the fields show the current search.
        key={listingSearchHref(search)}
        ref={formRef}
        action={LISTINGS_PATH}
        method='get'
        role='search'
        aria-label='Search properties'
        onSubmit={e => {
          e.preventDefault();
          apply(e.currentTarget);
        }}
        className='rounded-[1.75rem] border bg-card p-2 shadow-card'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center'>
          <fieldset className='flex shrink-0'>
            <legend className='sr-only'>What are you looking for?</legend>
            <div className='flex w-full gap-1 rounded-full bg-muted p-1'>
              {(Object.keys(LISTING_KINDS) as ListingKind[]).map(kind => (
                <label
                  key={kind}
                  className='relative flex-1 cursor-pointer lg:flex-none'>
                  <input
                    type='radio'
                    name='type'
                    value={kind}
                    defaultChecked={search.kind === kind}
                    onChange={submitOnChange}
                    className='peer sr-only'
                  />
                  <span className='block rounded-full px-4 py-2 text-center text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 ease-out-soft peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 hover:text-foreground'>
                    {LISTING_KINDS[kind].label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className='flex flex-1 gap-2'>
            <label className='relative min-w-0 flex-1'>
              <span className='sr-only'>Area, city or reference</span>
              <MapPin
                aria-hidden
                className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground'
              />
              <input
                name='q'
                type='search'
                defaultValue={search.q}
                placeholder='Area, city or PRP reference'
                autoComplete='off'
                maxLength={80}
                className='h-11 w-full rounded-full border border-input bg-background pr-4 pl-11 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25'
              />
            </label>
            <Button
              type='submit'
              size='lg'
              className='h-11 px-5'>
              {isPending ? (
                <Loader2
                  aria-hidden
                  className='animate-spin'
                />
              ) : (
                <Search aria-hidden />
              )}
              <span className='max-sm:sr-only'>Search</span>
            </Button>
          </div>
        </div>

        <div className='mt-2 grid grid-cols-2 gap-2 px-1 pb-1 sm:grid-cols-4'>
          <FilterSelect
            name='state'
            label='State'
            defaultValue={search.state ?? ''}
            onChange={submitOnChange}>
            <option value=''>Any state</option>
            {search.state && !states.includes(search.state) && <option value={search.state}>{search.state}</option>}
            {states.map(state => (
              <option
                key={state}
                value={state}>
                {state}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name='beds'
            label='Bedrooms'
            defaultValue={search.beds ? String(search.beds) : ''}
            onChange={submitOnChange}>
            <option value=''>Any bedrooms</option>
            {BED_OPTIONS.map(n => (
              <option
                key={n}
                value={n}>
                {n}+ {n === 1 ? 'bedroom' : 'bedrooms'}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name='max'
            label='Budget'
            defaultValue={search.maxPrice ? String(search.maxPrice) : ''}
            onChange={submitOnChange}>
            <option value=''>Any budget</option>
            {search.maxPrice && !(MAX_PRICE_OPTIONS as readonly number[]).includes(search.maxPrice) && (
              <option value={search.maxPrice}>Up to ₦{search.maxPrice.toLocaleString('en-NG')}</option>
            )}
            {MAX_PRICE_OPTIONS.map(n => (
              <option
                key={n}
                value={n}>
                Up to {shortNaira(n)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            name='sort'
            label='Sort by'
            defaultValue={search.sort}
            onChange={submitOnChange}>
            {Object.entries(LISTING_SORTS).map(([value, label]) => (
              <option
                key={value}
                value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>
        </div>

        {/* Without JavaScript the selects can't apply themselves. */}
        <noscript>
          <div className='px-1 pt-1 pb-1'>
            <Button
              type='submit'
              variant='outline'
              className='w-full'>
              Apply filters
            </Button>
          </div>
        </noscript>
      </form>

      <div className='mt-3 flex min-h-6 items-center justify-between gap-3 px-1 text-sm'>
        <p
          aria-live='polite'
          className='text-muted-foreground'>
          {isPending ? 'Updating results…' : ''}
        </p>
        {isFiltered(search) && (
          <Link
            href={LISTINGS_PATH}
            scroll={false}
            className='font-medium text-primary underline-offset-4 hover:underline'>
            Clear filters
          </Link>
        )}
      </div>

      <div
        aria-busy={isPending}
        className={cn('transition-opacity duration-200', isPending && 'opacity-55')}>
        {children}
      </div>
    </>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  onChange,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className='relative flex flex-col'>
      <span className='sr-only'>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={onChange}
        className='h-10 w-full cursor-pointer appearance-none truncate rounded-full border border-input bg-background pr-9 pl-4 text-sm outline-none transition-[border-color,box-shadow] hover:border-ink-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25'>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className='pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground'
      />
    </label>
  );
}
