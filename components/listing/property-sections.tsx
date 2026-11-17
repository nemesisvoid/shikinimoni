import Link from 'next/link';
import {
  BedDouble,
  Bath,
  Car,
  Check,
  ChevronRight,
  Layers,
  LandPlot,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  ShieldCheck,
  Sofa,
  Toilet,
} from 'lucide-react';
import { Roofline } from '@/components/landing/roofline';
import { DocumentLinks } from '@/components/listing/document-links';
import { EnquiryForm } from '@/components/listing/enquiry-form';
import { buttonVariants } from '@/components/ui/button';
import { AVAILABILITY_META } from '@/lib/admin/meta';
import { FURNISHING_LABEL, PROPERTY_TYPE_LABEL } from '@/lib/admin/property-options';
import { COUNTRIES } from '@/lib/data/locations';
import { formatPrice, formatSize, LISTING_TYPE_LABEL } from '@/lib/format';
import { locationLine } from '@/lib/listings/format';
import { formatRef, LISTINGS_PATH, listingSearchHref, propertyPath } from '@/lib/listings/search';
import type { ListingDetail } from '@/lib/listings/types';
import { digitsOnly, siteConfig } from '@/lib/site';
import { cn } from '@/lib/utils';

const listedDate = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

/** What a buyer is told when a listing is no longer simply "available". */
const CLOSED_NOTE: Record<Exclude<ListingDetail['availability'], 'AVAILABLE'>, string> = {
  UNDER_OFFER: 'Someone has made an offer. You can still enquire in case it falls through.',
  SOLD: 'This property has been sold. Ask us about similar ones.',
  RENTED: 'This property has been let. Ask us about similar ones.',
  OFF_MARKET: 'The owner has paused this listing for now. Ask us about similar ones.',
};

// ── Header ──────────────────────────────────────────────────────────────────

export function PropertyBreadcrumbs({ listing }: { listing: ListingDetail }) {
  const crumbs = [
    { href: '/', label: 'Home' },
    { href: LISTINGS_PATH, label: 'Properties' },
    { href: listingSearchHref({ state: listing.state }), label: listing.state },
  ];
  return (
    <nav aria-label='Breadcrumb'>
      <ol className='flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground'>
        {crumbs.map(c => (
          <li
            key={c.href}
            className='flex items-center gap-1.5'>
            <Link
              href={c.href}
              className='underline-offset-4 hover:text-foreground hover:underline'>
              {c.label}
            </Link>
            <ChevronRight
              aria-hidden
              className='size-3.5'
            />
          </li>
        ))}
        <li
          aria-current='page'
          className='max-w-[18rem] truncate font-medium text-foreground'>
          {listing.name}
        </li>
      </ol>
    </nav>
  );
}

export function PropertyTitle({ listing }: { listing: ListingDetail }) {
  const { amount, suffix } = formatPrice(listing.price, listing.currency, listing.pricePeriod);
  return (
    <div className='flex flex-wrap items-end justify-between gap-x-8 gap-y-4'>
      <div className='min-w-0 max-w-3xl'>
        <p className='flex flex-wrap items-center gap-2 text-sm font-medium'>
          <span className='rounded-full bg-plum-50 px-3 py-1 text-plum-800'>{LISTING_TYPE_LABEL[listing.listingType]}</span>
          <span className='rounded-full bg-muted px-3 py-1 text-ink-700'>{PROPERTY_TYPE_LABEL[listing.type]}</span>
          {listing.isFeatured && (
            <span className='rounded-full bg-highlight px-3 py-1 text-highlight-foreground'>Featured</span>
          )}
        </p>
        <h1 className='mt-4 text-h1 text-ink-950'>{listing.name}</h1>
        <p className='mt-3 flex items-center gap-1.5 text-lead text-muted-foreground'>
          <MapPin
            aria-hidden
            className='size-5 shrink-0'
          />
          {locationLine(listing)}
        </p>
      </div>
      {/* On large screens the price sits in the enquiry card instead. */}
      <p className='font-heading text-price-lg text-primary tabular-nums lg:hidden'>
        {amount}
        {suffix && <span className='ml-1 text-base font-medium tracking-normal text-muted-foreground'>{suffix}</span>}
      </p>
    </div>
  );
}

// ── Key facts ───────────────────────────────────────────────────────────────

export function KeyFacts({ listing: p }: { listing: ListingDetail }) {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const facts = [
    p.bedrooms !== null && { icon: <BedDouble />, value: p.bedrooms, label: plural(p.bedrooms, 'Bedroom', 'Bedrooms') },
    p.bathrooms !== null && { icon: <Bath />, value: p.bathrooms, label: plural(p.bathrooms, 'Bathroom', 'Bathrooms') },
    p.toilets !== null && { icon: <Toilet />, value: p.toilets, label: plural(p.toilets, 'Toilet', 'Toilets') },
    p.floorAreaSqm !== null && { icon: <Ruler />, value: formatSize(p.floorAreaSqm, 'SQM'), label: 'Floor area' },
    p.landSize !== null && p.landSizeUnit && { icon: <LandPlot />, value: formatSize(p.landSize, p.landSizeUnit), label: 'Land' },
    p.parkingSpaces !== null && { icon: <Car />, value: p.parkingSpaces, label: plural(p.parkingSpaces, 'Parking space', 'Parking spaces') },
    p.floors !== null && { icon: <Layers />, value: p.floors, label: plural(p.floors, 'Floor', 'Floors') },
    p.furnishing && { icon: <Sofa />, value: FURNISHING_LABEL[p.furnishing], label: 'Furnishing' },
  ].filter(Boolean) as { icon: React.ReactNode; value: string | number; label: string }[];

  if (facts.length === 0) return null;
  return (
    <section aria-label='Key facts'>
      {/* Flex, not grid: items stretch to fill the last row, so no empty grey cells show through the 1px gaps. */}
      <dl className='flex flex-wrap gap-px overflow-hidden rounded-2xl border bg-border'>
        {facts.map(f => (
          <div
            key={f.label}
            className='flex min-w-[9.5rem] flex-1 basis-[9.5rem] flex-col gap-2 bg-card p-4 sm:p-5'>
            <span
              aria-hidden
              className='text-plum-700 [&_svg]:size-5'>
              {f.icon}
            </span>
            <dt className='order-last text-sm text-muted-foreground'>{f.label}</dt>
            <dd className='font-heading text-xl font-bold tracking-tight tabular-nums'>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── Papers: the brand promise, so it comes first ────────────────────────────

export function TitlePapers({ listing }: { listing: ListingDetail }) {
  const hasDocs = listing.documents.length > 0;
  return (
    <section
      aria-labelledby='papers-heading'
      className='relative isolate overflow-hidden rounded-[2rem] bg-verified p-6 text-foreground sm:p-8'>
      <Roofline className='pointer-events-none absolute -top-2 right-6 -z-10 hidden w-36 opacity-40 sm:block' />
      <div className='flex items-start gap-4'>
        <span className='grid size-12 shrink-0 place-items-center rounded-2xl bg-background text-azure-700 shadow-sm'>
          <ShieldCheck
            aria-hidden
            className='size-6'
          />
        </span>
        <div className='min-w-0'>
          <h2
            id='papers-heading'
            className='text-h3'>
            Title and papers
          </h2>
          <p className='mt-1 text-sm text-verified-foreground'>
            {listing.titleType ? 'The seller says they hold:' : 'The seller hasn’t named a title document yet.'}
          </p>
          {listing.titleType && <p className='mt-2 font-heading text-h2 text-azure-900'>{listing.titleType}</p>}
        </div>
      </div>

      <div className='mt-6'>
        {hasDocs ? (
          <>
            <p className='mb-3 max-w-prose text-sm text-ink-700'>
              Shared by the seller so you can check them before you inspect. Have a lawyer confirm them at the land registry
              before you pay anything.
            </p>
            <DocumentLinks documents={listing.documents} />
          </>
        ) : (
          <p className='max-w-prose text-sm text-ink-700'>
            Ask to see the title documents when you enquire. We show the originals at inspection, and you should have a lawyer
            confirm them at the land registry before you pay anything.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Description, amenities, details, location ───────────────────────────────

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className='border-t pt-10'>
      <h2
        id={id}
        className='text-h2'>
        {title}
      </h2>
      <div className='mt-6'>{children}</div>
    </section>
  );
}

export function Description({ listing }: { listing: ListingDetail }) {
  const paragraphs = listing.description
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  return (
    <Section
      id='about-heading'
      title='About this property'>
      {listing.summary && <p className='max-w-prose text-lead font-medium text-ink-800'>{listing.summary}</p>}
      <div className={cn('max-w-prose space-y-4 leading-relaxed text-ink-700', listing.summary && 'mt-5')}>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className='whitespace-pre-line'>
            {p}
          </p>
        ))}
      </div>
    </Section>
  );
}

export function Amenities({ listing }: { listing: ListingDetail }) {
  if (listing.amenities.length === 0) return null;
  return (
    <Section
      id='features-heading'
      title='Features'>
      <div className='grid gap-8 sm:grid-cols-2'>
        {listing.amenities.map(({ group, items }) => (
          <div key={group}>
            <h3 className='text-sm font-semibold text-muted-foreground'>{group}</h3>
            <ul className='mt-3 space-y-2.5'>
              {items.map(item => (
                <li
                  key={item}
                  className='flex items-center gap-3'>
                  <span
                    aria-hidden
                    className='grid size-6 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-800'>
                    <Check className='size-3.5' />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function DetailsTable({ listing: p }: { listing: ListingDetail }) {
  const serviceCharge = p.serviceCharge !== null ? formatPrice(p.serviceCharge, p.currency, 'PER_YEAR') : null;
  const rows: [string, React.ReactNode][] = [
    ['Property type', PROPERTY_TYPE_LABEL[p.type]],
    ['Listing', LISTING_TYPE_LABEL[p.listingType]],
    ['Title', p.titleType ?? 'Ask us'],
    ...(p.yearBuilt ? ([['Year built', p.yearBuilt]] as [string, React.ReactNode][]) : []),
    ...(serviceCharge ? ([['Service charge', `${serviceCharge.amount}${serviceCharge.suffix}`]] as [string, React.ReactNode][]) : []),
    ['Reference', <span key='ref' className='tabular-nums'>{formatRef(p.refNumber)}</span>],
    ...(p.publishedAt ? ([['Listed', listedDate.format(p.publishedAt)]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <Section
      id='details-heading'
      title='Details'>
      <dl className='grid gap-x-10 sm:grid-cols-2'>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className='flex justify-between gap-6 border-b py-3.5'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='text-right font-medium'>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function Location({ listing: p }: { listing: ListingDetail }) {
  const country = COUNTRIES[p.address.country] ?? p.address.country;
  const lines = p.address.exact
    ? [p.address.line1, p.address.line2, [p.neighborhood, p.city].filter(Boolean).join(', '), [p.state, p.address.postalCode].filter(Boolean).join(' '), country]
    : [[p.neighborhood, p.city].filter(Boolean).join(', '), p.state, country];
  const query = p.coordinates ? `${p.coordinates.lat},${p.coordinates.lng}` : lines.filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <Section
      id='location-heading'
      title='Location'>
      <div className='flex flex-col gap-5 rounded-2xl border bg-ink-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'>
        <div className='flex gap-4'>
          <span className='grid size-11 shrink-0 place-items-center rounded-full bg-background text-plum-800 shadow-sm'>
            <MapPin
              aria-hidden
              className='size-5'
            />
          </span>
          <div>
            <address className='font-medium not-italic'>
              {lines.filter(Boolean).map(line => (
                <span
                  key={line}
                  className='block'>
                  {line}
                </span>
              ))}
            </address>
            {!p.address.exact && (
              <p className='mt-2 text-sm text-muted-foreground'>We share the exact address when you book an inspection.</p>
            )}
          </div>
        </div>
        <a
          href={mapsUrl}
          target='_blank'
          rel='noopener noreferrer'
          className={buttonVariants({ variant: 'outline', className: 'shrink-0 bg-background' })}>
          {p.address.exact ? 'Open in Google Maps' : 'See the area on Google Maps'}
        </a>
      </div>
    </Section>
  );
}

// ── The enquiry card (sticky beside the content on large screens) ───────────

export function EnquiryCard({ listing }: { listing: ListingDetail }) {
  const { amount, suffix } = formatPrice(listing.price, listing.currency, listing.pricePeriod);
  const serviceCharge = listing.serviceCharge !== null ? formatPrice(listing.serviceCharge, listing.currency, 'PER_YEAR') : null;
  const closed = listing.availability !== 'AVAILABLE';
  const status = AVAILABILITY_META[listing.availability];
  const ref = formatRef(listing.refNumber);
  const pageUrl = `${siteConfig.url}${propertyPath(listing.slug)}`;
  const whatsappText = `Hello ${siteConfig.name}, I'm interested in "${listing.name}" (${ref}). ${pageUrl}`;

  return (
    <div className='rounded-[2rem] border bg-card p-6 shadow-float sm:p-7'>
      <p className='flex items-center gap-2 text-sm font-medium'>
        <span
          aria-hidden
          className='size-2.5 rounded-full'
          style={{ backgroundColor: status.color }}
        />
        {status.label}
        <span className='text-muted-foreground'>· {LISTING_TYPE_LABEL[listing.listingType]}</span>
      </p>
      <p className='mt-3 font-heading text-price-lg text-primary tabular-nums'>
        {amount}
        {suffix && <span className='ml-1 text-base font-medium tracking-normal text-muted-foreground'>{suffix}</span>}
      </p>
      {(listing.isNegotiable || serviceCharge) && (
        <ul className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground'>
          {listing.isNegotiable && <li>Price negotiable</li>}
          {serviceCharge && (
            <li>
              Service charge {serviceCharge.amount}
              {serviceCharge.suffix}
            </li>
          )}
        </ul>
      )}

      {closed && (
        <p className='mt-4 rounded-xl bg-sunset-50 p-3 text-sm text-sunset-900'>
          {CLOSED_NOTE[listing.availability as keyof typeof CLOSED_NOTE]}
        </p>
      )}

      <div className='mt-6 border-t pt-6'>
        <h2
          id='enquire'
          className='scroll-mt-28 text-h3'>
          {closed ? 'Ask about this property' : 'Interested?'}
        </h2>
        <p className='mt-1 mb-5 text-sm text-muted-foreground'>Book an inspection or ask us anything about it.</p>
        <EnquiryForm
          propertyId={listing.id}
          closed={closed && listing.availability !== 'UNDER_OFFER'}
        />
      </div>

      <div className='mt-6 grid grid-cols-2 gap-2 border-t pt-6'>
        <a
          href={`https://wa.me/${digitsOnly(siteConfig.whatsapp)}?text=${encodeURIComponent(whatsappText)}`}
          target='_blank'
          rel='noopener noreferrer'
          className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <MessageCircle aria-hidden />
          WhatsApp
        </a>
        <a
          href={`tel:+${digitsOnly(siteConfig.phone)}`}
          className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <Phone aria-hidden />
          Call
        </a>
      </div>
      <p className='mt-4 text-center text-xs text-muted-foreground'>
        Quote <span className='font-semibold text-foreground tabular-nums'>{ref}</span> when you call.
      </p>
    </div>
  );
}

/** Phones: the price and a jump to the form stay on screen while you scroll. */
export function MobileEnquiryBar({ listing }: { listing: ListingDetail }) {
  const { amount, suffix } = formatPrice(listing.price, listing.currency, listing.pricePeriod);
  return (
    <div className='fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden'>
      <div className='mx-auto flex max-w-7xl items-center justify-between gap-4'>
        <p className='min-w-0 truncate font-heading text-lg font-extrabold text-primary tabular-nums'>
          {amount}
          {suffix && <span className='ml-0.5 text-sm font-medium text-muted-foreground'>{suffix}</span>}
        </p>
        <a
          href='#enquire'
          className={buttonVariants({ size: 'lg', className: 'shrink-0' })}>
          {listing.availability === 'AVAILABLE' ? 'Book an inspection' : 'Enquire'}
        </a>
      </div>
    </div>
  );
}
