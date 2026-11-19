import * as z from 'zod';
import { checkbox, emailAddress, requiredText, uuid } from './fields';

// ── Site settings ───────────────────────────────────────────────────────────

const MAX_HOURS_ROWS = 7;
const MAX_ALERT_EMAILS = 10;

/** Digits, spaces, brackets, dashes and a leading +; 7 to 15 digits in all. */
const phoneNumber = (label: string) =>
  requiredText(label, { max: 40 }).refine(
    v => /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15,
    { error: 'Enter a phone number, e.g. +234 803 123 4567 or 0803 123 4567' },
  );

const isEmail = (v: string) => z.email().safeParse(v).success;

/** Pairs the parallel `hoursDays` / `hoursTime` lists into rows, dropping empty ones. */
function zipHours(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return raw;
  const { hoursDays, hoursTime, ...rest } = raw as Record<string, unknown>;
  const days = Array.isArray(hoursDays) ? hoursDays.map(String) : [];
  const times = Array.isArray(hoursTime) ? hoursTime.map(String) : [];
  const hours = days.map((d, i) => ({ days: d.trim(), time: (times[i] ?? '').trim() })).filter(h => h.days || h.time);
  return { ...rest, hours };
}

const openingHours = z.array(z.object({ days: z.string(), time: z.string() })).superRefine((rows, ctx) => {
  if (rows.some(h => !h.days || !h.time)) {
    ctx.addIssue({ code: 'custom', message: 'Fill in both the days and the times, or remove the row' });
  } else if (rows.some(h => h.days.length > 40 || h.time.length > 40)) {
    ctx.addIssue({ code: 'custom', message: 'Use 40 characters or fewer in each box' });
  } else if (rows.length > MAX_HOURS_ROWS) {
    ctx.addIssue({ code: 'custom', message: `Use ${MAX_HOURS_ROWS} rows or fewer` });
  }
});

/** "a@x.com, b@y.com" → ["a@x.com", "b@y.com"], each checked. Blank is fine. */
const alertEmailList = z.preprocess(
  v =>
    typeof v === 'string'
      ? [
          ...new Set(
            v
              .split(/[\s,;]+/)
              .map(e => e.trim().toLowerCase())
              .filter(Boolean),
          ),
        ]
      : [],
  z.array(z.string()).superRefine((list, ctx) => {
    const bad = list.find(e => !isEmail(e));
    if (bad) ctx.addIssue({ code: 'custom', message: `“${bad}” isn’t an email address` });
    else if (list.some(e => e.length > 254)) ctx.addIssue({ code: 'custom', message: 'Use 254 characters or fewer per address' });
    else if (list.length > MAX_ALERT_EMAILS) ctx.addIssue({ code: 'custom', message: `Use ${MAX_ALERT_EMAILS} addresses or fewer` });
  }),
);

/**
 * Admin → Site settings. Opening hours arrive as two parallel lists
 * (`hoursDays`, `hoursTime`), one entry per row; parse with
 * `arrayFields: SITE_SETTINGS_ARRAY_FIELDS`. Each field is checked on its own,
 * so every problem shows at once. Errors for the rows come back under `hours`.
 */
export const SiteSettingsSchema = z
  .preprocess(
    zipHours,
    z.object({
      contactEmail: emailAddress(),
      phone: phoneNumber('a phone number'),
      whatsapp: phoneNumber('a WhatsApp number'),
      officeAddress: requiredText('the office address', { max: 300 }).refine(v => v.split(/\r?\n/).filter(l => l.trim()).length <= 4, {
        error: 'Use 4 lines or fewer',
      }),
      hours: openingHours,
      replyTime: requiredText('how soon you reply', { max: 60 }),
      alertEmails: alertEmailList,
    }),
  )
  .transform(data => ({
    contactEmail: data.contactEmail,
    phone: data.phone,
    whatsapp: data.whatsapp,
    officeAddress: data.officeAddress
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n'),
    openingHours: data.hours,
    // "We reply within two hours." → "within two hours": the site adds the rest.
    replyTime: normaliseReplyTime(data.replyTime),
    alertEmails: data.alertEmails.join(', ') || null,
  }));

export const SITE_SETTINGS_ARRAY_FIELDS = ['hoursDays', 'hoursTime'] as const;

/** Strips a typed "We reply" and the full stop, which the site adds itself. */
export const normaliseReplyTime = (text: string) =>
  text
    .trim()
    .replace(/^we reply\s+/i, '')
    .replace(/\.$/, '');

// ── Your profile ────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  name: requiredText('your name', { max: 80 }),
});

/** Passwords are never trimmed: spaces are allowed and count. */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Enter your current password' }).min(1, { error: 'Enter your current password' }),
    newPassword: z
      .string({ error: 'Enter a new password' })
      .min(8, { error: 'Use at least 8 characters' })
      .max(128, { error: 'Use 128 characters or fewer' }),
    confirmPassword: z.string({ error: 'Type the new password again' }).min(1, { error: 'Type the new password again' }),
    signOutOthers: checkbox(),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword && data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'This doesn’t match the new password' });
    }
    if (data.newPassword && data.newPassword === data.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Choose a password that’s different from your current one' });
    }
  });

// ── Team ────────────────────────────────────────────────────────────────────

export const AddAdminSchema = z.object({ email: emailAddress() });

export const UserIdSchema = uuid('account');
