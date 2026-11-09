'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Search,
  Star,
  X,
} from 'lucide-react';
import { AvailabilityLabel, ListingStatusBadge } from '@/components/admin/badges';
import { Button, buttonVariants } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AVAILABILITY_LABEL, CATEGORY_OPTIONS, LISTING_TYPE_OPTIONS } from '@/lib/admin/property-options';
import { LISTING_STATUS_META } from '@/lib/admin/meta';
import { formatPrice, formatRelativeTime } from '@/lib/format';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZES,
  type AdminPropertyRow,
  type PropertyTableQuery,
} from '@/lib/admin/property-table';
import type { Availability, ListingStatus, ListingType, PropertyCategory } from '@/lib/generated/prisma/enums';
import { cn } from '@/lib/utils';
import type { PropertySort } from '@/schemas/property.schema';


// ── URL ⇄ table state ───────────────────────────────────────────────────────

/** Sortable columns and the sort keys they map to: [ascending, descending]. */
const SORTS_BY_COLUMN: Record<string, [PropertySort, PropertySort]> = {
  name: ['name_asc', 'name_desc'],
  price: ['price_asc', 'price_desc'],
  updated: ['updated_asc', 'updated'],
};

function toSortingState(sort: PropertySort): SortingState {
  for (const [id, [asc, desc]] of Object.entries(SORTS_BY_COLUMN)) {
    if (sort === asc) return [{ id, desc: false }];
    if (sort === desc) return [{ id, desc: true }];
  }
  return [];
}

function toSort(sorting: SortingState): PropertySort {
  const first = sorting[0];
  const pair = first && SORTS_BY_COLUMN[first.id];
  return pair ? pair[first.desc ? 1 : 0] : DEFAULT_SORT;
}

/** Builds the URL, leaving out defaults so links stay short. */
function hrefFor(query: PropertyTableQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  if (query.listingType) params.set('listingType', query.listingType);
  if (query.category) params.set('category', query.category);
  if (query.availability) params.set('availability', query.availability);
  if (query.sort !== DEFAULT_SORT) params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(query.pageSize));
  const search = params.toString();
  return search ? `/admin/properties?${search}` : '/admin/properties';
}

const resolve = <T,>(updater: Updater<T>, current: T) =>
  typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;

// ── Columns (module scope: stable between renders) ─────────────────────────

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const column = createColumnHelper<typeof features, AdminPropertyRow>();

const columns = column.columns([
  column.accessor('name', {
    id: 'name',
    header: 'Property',
    cell: ({ row }) => <PropertyCell row={row.original} />,
  }),
  column.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: ({ getValue }) => <ListingStatusBadge status={getValue()} />,
  }),
  column.accessor('availability', {
    header: 'Availability',
    enableSorting: false,
    cell: ({ getValue }) => <AvailabilityLabel availability={getValue()} />,
  }),
  column.accessor('price', {
    id: 'price',
    header: 'Price',
    sortDescFirst: true,
    cell: ({ row }) => {
      const p = row.original;
      const { amount, suffix } = formatPrice(p.price === null ? null : Number(p.price), p.currency, p.pricePeriod);
      return (
        <span className='font-medium whitespace-nowrap tabular-nums'>
          {amount}
          {suffix && <span className='text-xs font-normal text-muted-foreground'>{suffix}</span>}
        </span>
      );
    },
  }),
  column.accessor('refNumber', {
    header: 'Ref',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className='text-muted-foreground tabular-nums'>PRP-{String(getValue()).padStart(5, '0')}</span>
    ),
  }),
  column.accessor('updatedAt', {
    id: 'updated',
    header: 'Updated',
    sortDescFirst: true,
    cell: ({ getValue }) => (
      <time
        dateTime={getValue()}
        suppressHydrationWarning
        className='whitespace-nowrap text-muted-foreground'>
        {formatRelativeTime(new Date(getValue()))}
      </time>
    ),
  }),
  column.display({
    id: 'actions',
    header: () => <span className='sr-only'>Actions</span>,
    cell: ({ row }) => (
      <Link
        href={`/admin/properties/${row.original.id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        aria-label={`Edit ${row.original.name}`}>
        <Pencil aria-hidden />
        Edit
      </Link>
    ),
  }),
]);

/** Per-column cell classes, by column id. */
const COLUMN_CLASS: Record<string, string> = {
  name: 'pl-5 min-w-64',
  price: 'text-right',
  refNumber: 'text-right',
  updated: 'text-right',
  actions: 'pr-3 text-right w-0',
};

const STATUS_OPTIONS = Object.fromEntries(Object.entries(LISTING_STATUS_META).map(([k, v]) => [k, v.label]));
const LISTING_TYPE_FILTER = Object.fromEntries(Object.entries(LISTING_TYPE_OPTIONS).map(([k, v]) => [k, v.label]));
const CATEGORY_FILTER = Object.fromEntries(Object.entries(CATEGORY_OPTIONS).map(([k, v]) => [k, v.label]));

// ── Table ───────────────────────────────────────────────────────────────────

export function PropertiesDataTable({
  rows,
  total,
  query,
}: {
  rows: AdminPropertyRow[];
  total: number;
  query: PropertyTableQuery;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (patch: Partial<PropertyTableQuery>) => {
    const next = { ...query, ...patch };
    startTransition(() => router.push(hrefFor(next), { scroll: false }));
  };
  // Any change to what's shown starts again from page 1.
  const filter = (patch: Partial<PropertyTableQuery>) => navigate({ ...patch, page: 1 });

  const sorting = toSortingState(query.sort);
  const pagination: PaginationState = { pageIndex: query.page - 1, pageSize: query.pageSize };

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: row => row.id,
    rowCount: total,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    state: { sorting, pagination },
    onSortingChange: updater => filter({ sort: toSort(resolve(updater, sorting)) }),
    onPaginationChange: updater => {
      const next = resolve(updater, pagination);
      if (next.pageSize !== pagination.pageSize) filter({ pageSize: next.pageSize });
      else navigate({ page: next.pageIndex + 1 });
    },
  });

  const hasFilters = Boolean(query.q || query.status || query.listingType || query.category || query.availability);
  const firstRow = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const lastRow = Math.min(total, query.page * query.pageSize);
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div className='flex flex-col gap-4'>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
        <SearchBox
          value={query.q ?? ''}
          onSearch={q => filter({ q: q || undefined })}
        />
        <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
          <FilterSelect
            label='Status'
            allLabel='Any status'
            options={STATUS_OPTIONS}
            value={query.status}
            onChange={v => filter({ status: v as ListingStatus | undefined })}
          />
          <FilterSelect
            label='Offered'
            allLabel='Sale or rent'
            options={LISTING_TYPE_FILTER}
            value={query.listingType}
            onChange={v => filter({ listingType: v as ListingType | undefined })}
          />
          <FilterSelect
            label='Category'
            allLabel='Any category'
            options={CATEGORY_FILTER}
            value={query.category}
            onChange={v => filter({ category: v as PropertyCategory | undefined })}
          />
          <FilterSelect
            label='Availability'
            allLabel='Any availability'
            options={AVAILABILITY_LABEL}
            value={query.availability}
            onChange={v => filter({ availability: v as Availability | undefined })}
          />
          {hasFilters && (
            <Button
              type='button'
              variant='ghost'
              onClick={() => filter({ q: undefined, status: undefined, listingType: undefined, category: undefined, availability: undefined })}>
              <X aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div
        aria-busy={isPending}
        className={cn('overflow-hidden rounded-2xl border bg-card transition-opacity', isPending && 'opacity-60')}>
        <Table className='min-w-232'>
          <TableHeader>
            {table.getHeaderGroups().map(group => (
              <TableRow
                key={group.id}
                className='hover:bg-transparent'>
                {group.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={COLUMN_CLASS[header.column.id]}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type='button'
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            '-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-muted hover:text-foreground',
                            sorted && 'text-foreground',
                          )}>
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp aria-hidden className='size-3.5' />
                          ) : sorted === 'desc' ? (
                            <ArrowDown aria-hidden className='size-3.5' />
                          ) : (
                            <ArrowUpDown aria-hidden className='size-3.5 opacity-40' />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getAllCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      className={cn('py-3', COLUMN_CLASS[cell.column.id])}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className='hover:bg-transparent'>
                <TableCell
                  colSpan={columns.length}
                  className='py-14 text-center'>
                  <p className='font-medium'>No properties match{query.q ? ` “${query.q}”` : ' these filters'}.</p>
                  <p className='mt-1 text-sm text-muted-foreground'>Try another search, or clear the filters to see everything.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <div className='flex flex-col-reverse gap-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
        <p
          className='text-muted-foreground'
          aria-live='polite'>
          {total === 0 ? 'No properties' : `Showing ${firstRow}–${lastRow} of ${total.toLocaleString('en-NG')}`}
        </p>
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <div className='flex items-center gap-2'>
            <span
              id='rows-per-page'
              className='text-muted-foreground'>
              Rows per page
            </span>
            <Select
              items={Object.fromEntries(PAGE_SIZES.map(n => [String(n), String(n)]))}
              value={String(query.pageSize)}
              onValueChange={v => v && table.setPageSize(Number(v))}>
              <SelectTrigger
                aria-labelledby='rows-per-page'
                className='w-20'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {PAGE_SIZES.map(n => (
                  <SelectItem
                    key={n}
                    value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-1'>
            <span className='mr-2 text-muted-foreground tabular-nums'>
              Page {query.page} of {pageCount}
            </span>
            <Button
              type='button'
              variant='outline'
              size='icon'
              aria-label='First page'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.setPageIndex(0)}>
              <ChevronsLeft />
            </Button>
            <Button
              type='button'
              variant='outline'
              size='icon'
              aria-label='Previous page'
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}>
              <ChevronLeft />
            </Button>
            <Button
              type='button'
              variant='outline'
              size='icon'
              aria-label='Next page'
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}>
              <ChevronRight />
            </Button>
            <Button
              type='button'
              variant='outline'
              size='icon'
              aria-label='Last page'
              disabled={!table.getCanNextPage()}
              onClick={() => table.setPageIndex(pageCount - 1)}>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function PropertyCell({ row }: { row: AdminPropertyRow }) {
  return (
    <div className='flex items-center gap-3'>
      <div className='relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted'>
        {row.coverUrl ? (
          <Image
            src={row.coverUrl}
            alt=''
            fill
            sizes='44px'
            className='object-cover'
          />
        ) : (
          <Building2
            aria-hidden
            className='absolute inset-0 m-auto size-5 text-muted-foreground'
          />
        )}
      </div>
      <div className='min-w-0'>
        <Link
          href={`/admin/properties/${row.id}`}
          className='flex max-w-[20rem] items-center gap-1.5 font-medium underline-offset-4 hover:underline'>
          <span className='truncate'>{row.name}</span>
          {row.isFeatured && (
            <Star
              aria-label='Featured'
              className='size-3.5 shrink-0 fill-sunset-400 text-sunset-500'
            />
          )}
        </Link>
        <p className='max-w-[20rem] truncate text-xs text-muted-foreground'>{row.location || 'No location yet'}</p>
      </div>
    </div>
  );
}

/** Searches as you type (after a short pause) or straight away on Enter. */
function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value);
  // Follow the URL when it changes from outside (back button, Clear).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onSearch(text.trim()), 350);
    return () => clearTimeout(timer);
    // onSearch is recreated every render; the text is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, value]);

  return (
    <form
      role='search'
      className='lg:w-80'
      onSubmit={e => {
        e.preventDefault();
        onSearch(text.trim());
      }}>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type='search'
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='Search name, area or PRP-00012'
          aria-label='Search properties'
          maxLength={80}
        />
      </InputGroup>
    </form>
  );
}

const ALL = '__all';

function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: Record<string, string>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select
      items={{ [ALL]: allLabel, ...options }}
      value={value ?? ALL}
      onValueChange={v => onChange(!v || v === ALL ? undefined : v)}>
      <SelectTrigger
        aria-label={label}
        className={cn('w-full sm:w-auto sm:min-w-40', value && 'border-primary/40 bg-plum-50/60')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {Object.entries(options).map(([key, text]) => (
          <SelectItem
            key={key}
            value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
