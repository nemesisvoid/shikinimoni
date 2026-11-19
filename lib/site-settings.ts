import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEFAULT_CONTACT, type OpeningHours, type SiteContact } from '@/lib/site';

/** Cache tag on getSiteContact(). Saving Site settings calls `updateTag(SITE_SETTINGS_TAG)`. */
export const SITE_SETTINGS_TAG = 'site-settings';

/**
 * The contact details the site shows, cached until an admin saves Site
 * settings. Falls back to DEFAULT_CONTACT until the first save.
 */
export async function getSiteContact(): Promise<SiteContact> {
  'use cache';
  cacheLife('days');
  cacheTag(SITE_SETTINGS_TAG);
  return readSiteContact();
}

/** Uncached read, for emails sent from after() and the settings form. */
export async function readSiteContact(): Promise<SiteContact> {
  const row = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_CONTACT;
  return {
    contactEmail: row.contactEmail,
    phone: row.phone,
    whatsapp: row.whatsapp,
    officeLines: splitLines(row.officeAddress),
    hours: parseHours(row.openingHours),
    replyTime: row.replyTime,
    alertEmails: splitEmails(row.alertEmails ?? ''),
  };
}

export const splitLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

export const splitEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(Boolean);

function parseHours(value: unknown): OpeningHours[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (h): h is OpeningHours => typeof h === 'object' && h !== null && typeof h.days === 'string' && typeof h.time === 'string',
  );
}
