import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Roofline } from '@/components/landing/roofline';
import { digitsOnly, siteConfig } from '@/lib/site';

const WHATSAPP_GREETING = 'Hello ShikiniMoni, I have a question about a property.';

/** The plum panel beside the form: the faster ways to reach a person. */
export function ContactChannels() {
  const channels = [
    {
      href: `https://wa.me/${digitsOnly(siteConfig.whatsapp)}?text=${encodeURIComponent(WHATSAPP_GREETING)}`,
      icon: <MessageCircle />,
      label: 'WhatsApp',
      value: siteConfig.whatsapp,
      note: 'Quickest for photos and documents',
      external: true,
    },
    {
      href: `tel:+${digitsOnly(siteConfig.phone)}`,
      icon: <Phone />,
      label: 'Call us',
      value: siteConfig.phone,
      note: 'During office hours',
    },
    {
      href: `mailto:${siteConfig.contactEmail}`,
      icon: <Mail />,
      label: 'Email',
      value: siteConfig.contactEmail,
      note: `We reply ${siteConfig.replyTime}`,
    },
  ];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.office.lines.join(', '))}`;

  return (
    <aside
      aria-labelledby='channels-heading'
      className='relative isolate overflow-hidden rounded-[2rem] bg-inverse p-6 text-inverse-foreground sm:p-8'>
      {/* Top-right, beside the short heading, so it never crosses the contact details. */}
      <Roofline className='pointer-events-none absolute top-8 right-8 -z-10 hidden w-28 opacity-70 sm:block' />

      <h2
        id='channels-heading'
        className='text-h3'>
        Prefer to talk?
      </h2>
      <p className='mt-1.5 text-plum-100'>Reach the same team directly.</p>

      <ul className='mt-6 flex flex-col gap-2'>
        {channels.map(c => (
          <li key={c.label}>
            <a
              href={c.href}
              {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className='group flex items-center gap-4 rounded-2xl p-3 -mx-3 transition-colors duration-200 hover:bg-white/8 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none'>
              <span
                aria-hidden
                className='grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-highlight transition-colors duration-200 group-hover:bg-highlight group-hover:text-highlight-foreground [&_svg]:size-5'>
                {c.icon}
              </span>
              <span className='min-w-0'>
                <span className='block text-sm text-plum-200'>{c.label}</span>
                <span className='block truncate font-semibold'>{c.value}</span>
                <span className='block text-sm text-plum-200'>{c.note}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div className='mt-6 grid gap-5 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
        <div className='flex gap-3'>
          <MapPin
            aria-hidden
            className='mt-0.5 size-5 shrink-0 text-highlight'
          />
          <div>
            <h3 className='text-sm text-plum-200'>Office</h3>
            <address className='mt-1 font-medium not-italic'>
              {siteConfig.office.lines.map(line => (
                <span
                  key={line}
                  className='block'>
                  {line}
                </span>
              ))}
            </address>
            <a
              href={mapsUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-1.5 inline-block text-sm font-medium text-highlight underline-offset-4 hover:underline'>
              Open in Google Maps
            </a>
          </div>
        </div>
        <div className='flex gap-3'>
          <Clock
            aria-hidden
            className='mt-0.5 size-5 shrink-0 text-highlight'
          />
          <div>
            <h3 className='text-sm text-plum-200'>Office hours</h3>
            <dl className='mt-1 flex flex-col gap-1'>
              {siteConfig.office.hours.map(h => (
                <div key={h.days}>
                  <dt className='font-medium'>{h.days}</dt>
                  <dd className='text-sm text-plum-100'>{h.time}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </aside>
  );
}
