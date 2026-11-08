import Image from "next/image";
import { CalendarCheck, FileCheck2, MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Roofline } from "@/components/landing/roofline";
import { HERO_IMAGE } from "@/lib/data/dummy-properties";

const SEARCH_TYPES = [
  { value: "", label: "All" },
  { value: "sale", label: "Buy" },
  { value: "rent", label: "Rent" },
  { value: "land", label: "Land" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-y-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-x-12 lg:px-8 lg:pt-14 lg:pb-24">
        <div className="max-w-xl">
          <h1 className="text-display text-ink-950 motion-safe:animate-rise">
            Land and homes with papers you can trust.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lead text-muted-foreground motion-safe:animate-rise [animation-delay:120ms]">
            Browse plots, houses and apartments across Lagos, Abuja and Ogun. Every listing shows its title
            document before you book an inspection.
          </p>

          <HeroSearch />

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground motion-safe:animate-rise [animation-delay:360ms]">
            <li className="flex items-center gap-2">
              <FileCheck2 aria-hidden className="size-4 text-plum-700" />
              Title shown on every listing
            </li>
            <li className="flex items-center gap-2">
              <CalendarCheck aria-hidden className="size-4 text-plum-700" />
              Book inspections online
            </li>
          </ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroSearch() {
  return (
    <form
      action="/#listings"
      method="get"
      role="search"
      aria-label="Search listings"
      className="mt-8 rounded-[1.75rem] border bg-card p-2 shadow-float motion-safe:animate-rise [animation-delay:240ms]"
    >
      <fieldset className="flex">
        <legend className="sr-only">What are you looking for?</legend>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {SEARCH_TYPES.map((option) => (
            <label key={option.label} className="relative cursor-pointer">
              <input
                type="radio"
                name="type"
                value={option.value}
                defaultChecked={option.value === ""}
                className="peer sr-only"
              />
              <span className="block rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 ease-out-soft peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 hover:text-foreground">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Area or city</span>
          <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder="Area or city, e.g. Lekki"
            autoComplete="off"
            className="h-12 w-full rounded-full border border-input bg-background pr-4 pl-11 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
          />
        </label>
        <Button type="submit" size="lg" className="h-12 px-6 text-base">
          <Search aria-hidden />
          Search
        </Button>
      </div>
    </form>
  );
}

/**
 * The signature moment: the photo rises into a house silhouette, then the
 * logo's two roof strokes draw over it, then the verified-title card settles in.
 */
function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem] lg:max-w-none">
      <div className="absolute inset-y-0 right-[8.333%] left-[8.333%] overflow-hidden bg-plum-100 [clip-path:var(--clip-house)] motion-safe:animate-house-rise">
        <Image
          src={HERO_IMAGE.url}
          alt={HERO_IMAGE.alt}
          fill
          preload
          sizes="(min-width: 1024px) 45vw, 90vw"
          className="object-cover motion-safe:animate-settle"
        />
      </div>

      <Roofline animated className="absolute inset-0 size-full" />

      <div className="absolute bottom-[9%] left-0 flex items-center gap-3 rounded-2xl border bg-card/95 py-3 pr-5 pl-3 shadow-float backdrop-blur motion-safe:animate-pop [animation-delay:1500ms]">
        <span className="grid size-10 place-items-center rounded-xl bg-verified text-verified-foreground">
          <ShieldCheck aria-hidden className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold">Certificate of Occupancy</span>
          <span className="block text-xs text-muted-foreground">Banana Island, Ikoyi</span>
        </span>
      </div>
    </div>
  );
}
