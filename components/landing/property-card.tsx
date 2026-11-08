import Image from "next/image";
import { Bath, BedDouble, MapPin, Ruler, ShieldCheck } from "lucide-react";
import type { ListingCardData } from "@/lib/data/dummy-properties";
import { formatPrice, formatSize, LISTING_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

function sizeLabel(p: ListingCardData) {
  if (p.category === "LAND" && p.landSize && p.landSizeUnit) return formatSize(p.landSize, p.landSizeUnit);
  if (p.floorAreaSqm) return formatSize(p.floorAreaSqm, "SQM");
  if (p.landSize && p.landSizeUnit) return formatSize(p.landSize, p.landSizeUnit);
  return null;
}

export function PropertyCard({ property: p, featured = false }: { property: ListingCardData; featured?: boolean }) {
  const { amount, suffix } = formatPrice(p.price, p.currency, p.pricePeriod);
  const size = sizeLabel(p);
  const location = [p.neighborhood, p.city, p.state].filter(Boolean).join(", ");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card">
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          featured ? "aspect-video lg:aspect-auto lg:min-h-80 lg:flex-1" : "aspect-4/3",
        )}
      >
        <Image
          src={p.coverImage.url}
          alt={p.coverImage.alt}
          fill
          sizes={featured ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"}
          className="object-cover"
        />
        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">
          {LISTING_TYPE_LABEL[p.listingType]}
        </span>
        {featured && (
          <span className="absolute top-3 right-3 rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-foreground">
            Featured
          </span>
        )}
      </div>

      <div className={cn("flex flex-col gap-2 p-5", featured && "lg:p-7")}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <p className={cn("font-heading text-primary tabular-nums", featured ? "text-price-lg" : "text-price")}>
            {amount}
            {suffix && <span className="ml-0.5 text-sm font-medium tracking-normal text-muted-foreground">{suffix}</span>}
          </p>
          {p.titleType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2.5 py-1 text-xs font-semibold text-verified-foreground">
              <ShieldCheck aria-hidden className="size-3.5" />
              {p.titleType}
            </span>
          )}
        </div>

        <h3 className={cn(featured ? "text-h2" : "text-h3")}>{p.name}</h3>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-4 shrink-0" />
          {location}
        </p>

        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-sm text-ink-700">
          {p.bedrooms !== null && (
            <li className="flex items-center gap-1.5">
              <BedDouble aria-hidden className="size-4 text-muted-foreground" />
              {p.bedrooms} {p.bedrooms === 1 ? "bed" : "beds"}
            </li>
          )}
          {p.bathrooms !== null && p.category !== "LAND" && (
            <li className="flex items-center gap-1.5">
              <Bath aria-hidden className="size-4 text-muted-foreground" />
              {p.bathrooms} {p.bathrooms === 1 ? "bath" : "baths"}
            </li>
          )}
          {size && (
            <li className="flex items-center gap-1.5">
              <Ruler aria-hidden className="size-4 text-muted-foreground" />
              {size}
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
