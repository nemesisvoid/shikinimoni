import * as z from 'zod';
import { optionalText, requiredText } from './fields';

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
