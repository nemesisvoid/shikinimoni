import * as z from 'zod';
import { InquiryStatus } from '@/lib/generated/prisma/enums';
import { optionalText, requiredEnum, requiredText, uuid } from './fields';

/** What a contact-page message is about. Stored at the top of the inquiry message. */
export const CONTACT_TOPICS = {
  buying: 'Buying a property',
  renting: 'Renting or leasing',
  selling: 'Selling or listing a property',
  other: 'Something else',
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;
export const isContactTopic = (v: unknown): v is ContactTopic => typeof v === 'string' && v in CONTACT_TOPICS;

const email = () =>
  z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() || undefined : v),
    z
      .email({ error: 'Enter an email address like name@example.com' })
      .max(254, { error: 'Use 254 characters or fewer' }),
  );

/** Digits, spaces, brackets, dashes and a leading +. Blank is fine. */
const phone = () =>
  optionalText(30).refine(v => v == null || /^\+?[\d\s()-]{7,}$/.test(v), {
    error: 'Enter a phone number, e.g. 0803 123 4567',
  });

/** The public contact form. Field names match the form's inputs (FormData). */
export const ContactMessageSchema = z.object({
  name: requiredText('your name', { min: 2, max: 120 }),
  email: email(),
  phone: phone(),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]], {
    error: 'Choose what your message is about',
  }),
  message: requiredText('a message', { min: 10, max: 5000 }),
});

export type ContactMessageInput = z.output<typeof ContactMessageSchema>;

// ── Enquiry about one property (the form on the property page) ─────────────

export const ENQUIRY_INTENTS = {
  viewing: 'Book an inspection',
  question: 'Ask a question',
} as const;
export type EnquiryIntent = keyof typeof ENQUIRY_INTENTS;

/** How far ahead someone can ask to inspect. */
export const MAX_VIEWING_DAYS_AHEAD = 90;

/** Today's date in Lagos as YYYY-MM-DD (West Africa Time is UTC+1, no daylight saving). */
export function lagosToday(now = Date.now()) {
  return new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Phone is required to book an inspection (the agent calls to confirm the time);
 * a question needs a message instead.
 */
export const PropertyEnquirySchema = z
  .object({
    propertyId: z.uuid({ error: 'This property is no longer listed' }),
    intent: z.enum(Object.keys(ENQUIRY_INTENTS) as [EnquiryIntent, ...EnquiryIntent[]], {
      error: 'Choose what you’d like to do',
    }),
    name: requiredText('your name', { min: 2, max: 120 }),
    email: email(),
    phone: phone(),
    preferredDate: optionalText(10).refine(v => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      error: 'Pick a date from the calendar',
    }),
    message: optionalText(5000),
  })
  // Runs even when other fields failed, so every problem shows at once. Values
  // may be unparsed here, hence the defensive reads.
  .superRefine(
    (v, ctx) => {
      const text = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
      const message = text(v.message);
      const date = text(v.preferredDate);
      if (v.intent === 'viewing' && !text(v.phone)) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add a phone number so we can confirm the time' });
      }
      if (v.intent === 'question' && message.length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['message'],
          message: message ? 'Use at least 10 characters' : 'Enter your question',
        });
      }
      if (v.intent === 'viewing' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const today = lagosToday();
        if (date < today) {
          ctx.addIssue({ code: 'custom', path: ['preferredDate'], message: 'Pick today or a later date' });
        } else if (date > addDays(today, MAX_VIEWING_DAYS_AHEAD)) {
          ctx.addIssue({
            code: 'custom',
            path: ['preferredDate'],
            message: `Pick a date within the next ${MAX_VIEWING_DAYS_AHEAD} days`,
          });
        }
      }
    },
    { when: () => true },
  );

export type PropertyEnquiryInput = z.output<typeof PropertyEnquirySchema>;

// ── Admin: handling an enquiry ──────────────────────────────────────────────

export const UpdateInquirySchema = z.object({
  id: uuid('enquiry'),
  status: requiredEnum(InquiryStatus, 'a status'),
  /** Internal only; never shown to the sender. Blank clears it. */
  adminNotes: optionalText(5000),
});
export type UpdateInquiryInput = z.output<typeof UpdateInquirySchema>;
