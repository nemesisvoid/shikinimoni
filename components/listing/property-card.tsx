import Image from 'next/image';
import Link from 'next/link';
import { Bath, BedDouble, MapPin, Ruler, ShieldCheck } from 'lucide-react';
import { PhotoPlaceholder } from '@/components/listing/photo-placeholder';
import { AVAILABILITY_LABEL } from '@/lib/admin/property-options';
import { formatPrice, LISTING_TYPE_LABEL } from '@/lib/format';
import { locationLine, sizeLabel } from '@/lib/listings/format';
import { propertyPath } from '@/lib/listings/search';
import type { ListingCardData } from '@/lib/listings/types';
import { cn } from '@/lib/utils';

/**
 * One listing in a grid. The whole card is clickable (the title's link stretches
 * over it), but only the title is a link, so screen readers hear it once.
 */
export function PropertyCard({
  property: p,
  featured = false,
  headingLevel: Heading = 'h3',
}: {
  property: ListingCardData;
  featured?: boolean;
  headingLevel?: 'h2' | 'h3';
}) {
  const { amount, suffix } = formatPrice(p.price, p.currency, p.pricePeriod);
  const size = sizeLabel(p);
  const closed = p.availability !== 'AVAILABLE';

  return (
    <article className='group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-shadow duration-200 focus-within:ring-3 focus-within:ring-ring/40 hover:shadow-float'>
      <div
        className={cn(
          'relative overflow-hidden bg-muted',
          featured ? 'aspect-video lg:aspect-auto lg:min-h-80 lg:flex-1' : 'aspect-4/3',
        )}>
        {p.coverImage ? (
          <Image
            src={p.coverImage.url}
            alt={p.coverImage.alt}
            fill
            sizes={featured ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw'}
            className='object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]'
          />
        ) : (
          <PhotoPlaceholder className='absolute inset-0' />
        )}
        <div className='absolute top-3 left-3 flex flex-wrap gap-1.5'>
          <span className='rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur'>
            {LISTING_TYPE_LABEL[p.listingType]}
          </span>
          {closed && (
            <span className='rounded-full bg-ink-900/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur'>
              {AVAILABILITY_LABEL[p.availability]}
            </span>
          )}
        </div>
        {featured && (
          <span className='absolute top-3 right-3 rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-foreground'>
            Featured
          </span>
        )}
      </div>

      <div className={cn('flex flex-col gap-2 p-5', featured && 'lg:p-7')}>
        <div className='flex flex-wrap items-start justify-between gap-x-3 gap-y-2'>
          <p className={cn('font-heading text-primary tabular-nums', featured ? 'text-price-lg' : 'text-price')}>
            {amount}
            {suffix && <span className='ml-0.5 text-sm font-medium tracking-normal text-muted-foreground'>{suffix}</span>}
          </p>
          {p.titleType && (
            <span className='inline-flex items-center gap-1 rounded-full bg-verified px-2.5 py-1 text-xs font-semibold text-verified-foreground'>
              <ShieldCheck
                aria-hidden
                className='size-3.5'
              />
              {p.titleType}
            </span>
          )}
        </div>

        <Heading className={cn(featured ? 'text-h2' : 'text-h3')}>
          <Link
            href={propertyPath(p.slug)}
            className='outline-none after:absolute after:inset-0 after:content-[""] group-hover:text-primary'>
            {p.name}
          </Link>
        </Heading>

        <p className='flex items-center gap-1.5 text-sm text-muted-foreground'>
          <MapPin
            aria-hidden
            className='size-4 shrink-0'
          />
          {locationLine(p)}
        </p>

        {(p.bedrooms !== null || size || (p.bathrooms !== null && p.category !== 'LAND')) && (
          <ul className='mt-2 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-sm text-ink-700'>
            {p.bedrooms !== null && (
              <li className='flex items-center gap-1.5'>
                <BedDouble
                  aria-hidden
                  className='size-4 text-muted-foreground'
                />
                {p.bedrooms} {p.bedrooms === 1 ? 'bed' : 'beds'}
              </li>
            )}
            {p.bathrooms !== null && p.category !== 'LAND' && (
              <li className='flex items-center gap-1.5'>
                <Bath
                  aria-hidden
                  className='size-4 text-muted-foreground'
                />
                {p.bathrooms} {p.bathrooms === 1 ? 'bath' : 'baths'}
              </li>
            )}
            {size && (
              <li className='flex items-center gap-1.5'>
                <Ruler
                  aria-hidden
                  className='size-4 text-muted-foreground'
                />
                {size}
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}
