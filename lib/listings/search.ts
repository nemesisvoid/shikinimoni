/**
 * The public property search: which filters exist, how they read from and
 * write to the URL. Client-safe (no server imports), so the filter bar and the
 * server query share one definition.
 *
 * URL params: ?q=lekki&type=sale&beds=3&max=100000000&state=Lagos&sort=price_asc&page=2
 */

export const LISTINGS_PATH = '/properties';
export const PAGE_SIZE = 12;

/** `type` in the URL. "rent" covers rent, lease and short let; "land" is any land listing. */
export const LISTING_KINDS = {
  all: { label: 'All', heading: 'Properties for sale and rent' },
  sale: { label: 'Buy', heading: 'Properties for sale' },
  rent: { label: 'Rent', heading: 'Properties to rent or lease' },
  land: { label: 'Land', heading: 'Land' },
} as const;
export type ListingKind = keyof typeof LISTING_KINDS;

export const LISTING_SORTS = {
  newest: 'Newest first',
  price_asc: 'Lowest price',
  price_desc: 'Highest price',
} as const;
export type ListingSort = keyof typeof LISTING_SORTS;

export const BED_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Budget ceilings in naira. Wide enough for a yearly rent and a duplex. */
export const MAX_PRICE_OPTIONS = [
  1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000,
] as const;

export type ListingSearch = {
  q: string;
  kind: ListingKind;
  beds: number | null;
  maxPrice: number | null;
  state: string | null;
  sort: ListingSort;
  page: number;
};

export const DEFAULT_SEARCH: ListingSearch = {
  q: '',
  kind: 'all',
  beds: null,
  maxPrice: null,
  state: null,
  sort: 'newest',
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

/** Unknown or malformed values fall back to the default, so a hand-edited URL never errors. */
export function parseListingSearch(params: RawParams): ListingSearch {
  const type = first(params.type);
  const sort = first(params.sort);
  const beds = Number(first(params.beds));
  const max = Number(first(params.max));
  const page = Number(first(params.page));
  const state = first(params.state).slice(0, 60);

  return {
    q: first(params.q).replace(/\s+/g, ' ').slice(0, 80),
    kind: type in LISTING_KINDS ? (type as ListingKind) : 'all',
    beds: Number.isInteger(beds) && beds >= 1 && beds <= 10 ? beds : null,
    maxPrice: Number.isFinite(max) && max > 0 ? Math.floor(max) : null,
    state: state || null,
    sort: sort in LISTING_SORTS ? (sort as ListingSort) : 'newest',
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** The search as URL params, leaving out defaults so links stay short. */
export function listingSearchParams(search: Partial<ListingSearch>) {
  const s = { ...DEFAULT_SEARCH, ...search };
  const params = new URLSearchParams();
  if (s.q) params.set('q', s.q);
  if (s.kind !== 'all') params.set('type', s.kind);
  if (s.beds) params.set('beds', String(s.beds));
  if (s.maxPrice) params.set('max', String(s.maxPrice));
  if (s.state) params.set('state', s.state);
  if (s.sort !== 'newest') params.set('sort', s.sort);
  if (s.page > 1) params.set('page', String(s.page));
  return params;
}

export function listingSearchHref(search: Partial<ListingSearch>) {
  const query = listingSearchParams(search).toString();
  return query ? `${LISTINGS_PATH}?${query}` : LISTINGS_PATH;
}

export const isFiltered = (s: ListingSearch) => Boolean(s.q || s.kind !== 'all' || s.beds || s.maxPrice || s.state);

/** "PRP-00123" or "prp123" → 123, for searching by reference. */
export function parseRefNumber(q: string) {
  const match = /^prp-?0*(\d{1,9})$/i.exec(q.trim());
  return match ? Number(match[1]) : null;
}

/** Same format as the admin tables, so a buyer's reference matches what staff see. */
export const formatRef = (refNumber: number) => `PRP-${String(refNumber).padStart(5, '0')}`;

export const propertyPath = (slug: string) => `${LISTINGS_PATH}/${slug}`;
