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
} as const;

export type OpeningHours = { days: string; time: string };

/**
 * How visitors reach the team. Admins edit it in Admin → Site settings; read it
 * with getSiteContact() (lib/site-settings.ts).
 */
export type SiteContact = {
  contactEmail: string;
  /** Shown as written; links use international digits (see phoneDigits). */
  phone: string;
  whatsapp: string;
  officeLines: string[];
  hours: OpeningHours[];
  /** Finishes "We reply …", e.g. "within one working day". */
  replyTime: string;
  /** Who gets new-enquiry alerts. Empty = the contact email. */
  alertEmails: string[];
};

/** Used until an admin saves Site settings for the first time. */
export const DEFAULT_CONTACT: SiteContact = {
  contactEmail: "hello@shikinimoni.com",
  phone: "+234 800 000 0000",
  whatsapp: "+234 800 000 0000",
  officeLines: ["Lekki Phase 1", "Lagos, Nigeria"],
  hours: [
    { days: "Monday to Friday", time: "9am to 6pm" },
    { days: "Saturday", time: "10am to 3pm" },
  ],
  replyTime: "within one working day",
  alertEmails: [],
};

/** "+234 800 000 0000" → "2348000000000". */
export const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

/**
 * A Nigerian number in international digits, for tel: and wa.me links:
 * "0803 123 4567" → "2348031234567". Numbers with a country code are left alone.
 */
export function whatsappNumber(phone: string) {
  const digits = digitsOnly(phone);
  return digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
}

export const telHref = (phone: string) => `tel:+${whatsappNumber(phone)}`;

export const whatsappHref = (phone: string, text?: string) =>
  `https://wa.me/${whatsappNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
