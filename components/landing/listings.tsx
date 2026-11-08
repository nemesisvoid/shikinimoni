import Link from "next/link";
import { PropertyCard } from "@/components/landing/property-card";
import { buttonVariants } from "@/components/ui/button";
import { DUMMY_PROPERTIES, type ListingCardData } from "@/lib/data/dummy-properties";

const FILTERS: Record<string, { heading: string; match: (p: ListingCardData) => boolean }> = {
  "": { heading: "Latest listings", match: () => true },
  sale: { heading: "For sale", match: (p) => p.listingType === "SALE" },
  rent: { heading: "To rent or lease", match: (p) => p.listingType !== "SALE" },
  land: { heading: "Land", match: (p) => p.category === "LAND" },
};

function matchesQuery(p: ListingCardData, q: string) {
  if (!q) return true;
  const haystack = [p.name, p.neighborhood, p.city, p.state].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function Listings({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const typeKey = typeof params.type === "string" && params.type in FILTERS ? params.type : "";
  const filter = FILTERS[typeKey];
  const isFiltered = Boolean(q || typeKey);

  const results = DUMMY_PROPERTIES.filter((p) => filter.match(p) && matchesQuery(p, q));
  const showFeatured = results.length >= 3 && results[0].isFeatured;

  return (
    <ListingsShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h1">
            {filter.heading}
            {q && <span className="text-muted-foreground"> in “{q}”</span>}
          </h2>
          <p className="mt-2 text-muted-foreground" aria-live="polite">
            {results.length} {results.length === 1 ? "property" : "properties"}
            {isFiltered ? " match your search." : " across Lagos, Abuja and Ogun."}
          </p>
        </div>
        {isFiltered && (
          <Link href="/#listings" className={buttonVariants({ variant: "outline" })}>
            Clear search
          </Link>
        )}
      </div>

      {results.length > 0 ? (
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((p, i) => {
            const featured = showFeatured && i === 0;
            return (
              <li key={p.id} className={featured ? "md:col-span-2 lg:row-span-2" : undefined}>
                <PropertyCard property={p} featured={featured} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-heading text-h3">No listings match that search yet.</p>
          <p className="mt-2 text-muted-foreground">Try a nearby area, or clear the search to see everything.</p>
          <Link href="/#listings" className={buttonVariants({ className: "mt-6" })}>
            Show all listings
          </Link>
        </div>
      )}
    </ListingsShell>
  );
}

function ListingsShell({ children }: { children: React.ReactNode }) {
  return (
    <section id="listings" aria-label="Property listings" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function ListingsSkeleton() {
  return (
    <ListingsShell>
      <div className="h-12 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-card">
            <div className="aspect-4/3 animate-pulse bg-muted" />
            <div className="space-y-3 p-5">
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </ListingsShell>
  );
}
