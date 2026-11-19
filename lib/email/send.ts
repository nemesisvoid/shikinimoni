import 'server-only';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import type { SiteContact } from '@/lib/site';

/**
 * Outgoing email through Resend. Configured by three env vars:
 *
 *   RESEND_API_KEY        API key from resend.com/api-keys (sending access is enough)
 *   EMAIL_FROM            Sender on your verified domain, e.g. "ShikiniMoni <hello@shikinimoni.com>"
 *   ENQUIRY_NOTIFY_EMAIL  Who gets new-enquiry alerts when Admin → Site settings doesn't say; comma-separate several.
 *
 * Alert recipients, first match wins: the "Enquiry alerts go to" field in Site
 * settings, then ENQUIRY_NOTIFY_EMAIL, then the site's contact email.
 *
 * Without RESEND_API_KEY or EMAIL_FROM nothing is sent (a warning is logged), so
 * local development and the forms keep working before email is set up.
 */

let client: Resend | null = null;
let warned = false;

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    if (!warned) {
      console.warn('Email is off: set RESEND_API_KEY and EMAIL_FROM to send enquiry emails.');
      warned = true;
    }
    return null;
  }
  client ??= new Resend(apiKey);
  return { resend: client, from };
}

/** The team inboxes that get new-enquiry alerts. */
export function teamRecipients(contact: SiteContact) {
  if (contact.alertEmails.length > 0) return contact.alertEmails;
  // `||`, not `??`: a blank ENQUIRY_NOTIFY_EMAIL= line should still fall back.
  const list = (process.env.ENQUIRY_NOTIFY_EMAIL?.trim() || contact.contactEmail)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return list;
}

type SendInput = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  /** Same key within 24 hours = Resend sends once, so a retry never doubles an email. */
  idempotencyKey: string;
  /** Shows in the Resend dashboard for filtering, e.g. "enquiry-alert". */
  category: string;
};

/**
 * Sends one email. Never throws: a failed send is logged and reported in the
 * result, because email is a side effect of saving an enquiry, not part of it.
 */
export async function sendEmail({ to, subject, react, replyTo, idempotencyKey, category }: SendInput) {
  const cfg = config();
  if (!cfg) return { ok: false as const, skipped: true };

  try {
    const { data, error } = await cfg.resend.emails.send(
      {
        from: cfg.from,
        to,
        subject,
        react,
        replyTo,
        tags: [{ name: 'category', value: category }],
      },
      { idempotencyKey },
    );
    if (error) {
      console.error(`Email "${category}" failed:`, error.name, error.message);
      return { ok: false as const, skipped: false };
    }
    return { ok: true as const, id: data?.id };
  } catch (error) {
    console.error(`Email "${category}" failed:`, error);
    return { ok: false as const, skipped: false };
  }
}
