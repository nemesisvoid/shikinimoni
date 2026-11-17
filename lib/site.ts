/**
 * The public origin, used for canonical URLs, the sitemap and share links.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://shikinimoni.com).
 */
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");

export const siteConfig = {
  name: "ShikiniMoni",
  url: siteUrl,
  tagline: "Land and homes with papers you can trust",
  description: "Buy, rent or lease land and homes across Nigeria, with title documents shown on every listing.",
  // TODO: replace every contact detail below with the real ones before launch.
  contactEmail: "hello@shikinimoni.com",
  /** Shown as written; `tel:` and WhatsApp links use the digits only. */
  phone: "+234 800 000 0000",
  whatsapp: "+234 800 000 0000",
  office: {
    lines: ["Lekki Phase 1", "Lagos, Nigeria"],
    hours: [
      { days: "Monday to Friday", time: "9am to 6pm" },
      { days: "Saturday", time: "10am to 3pm" },
    ],
  },
  /** How soon the team answers messages from the contact form. */
  replyTime: "within one working day",
} as const;

/** "+234 800 000 0000" → "2348000000000" for tel: and wa.me links. */
export const digitsOnly = (phone: string) => phone.replace(/\D/g, "");
