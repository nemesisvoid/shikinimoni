'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { readSiteContact, SITE_SETTINGS_TAG } from '@/lib/site-settings';
import { parseFormData } from '@/schemas/form-data';
import { SITE_SETTINGS_ARRAY_FIELDS, SiteSettingsSchema } from '@/schemas/settings.schema';

export type SiteSettingsField = 'contactEmail' | 'phone' | 'whatsapp' | 'officeAddress' | 'hours' | 'replyTime' | 'alertEmails';

export type SiteSettingsState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<SiteSettingsField, string>> };

/** Saves Admin → Site settings. The site shows the new details straight away. */
export async function saveSiteSettings(_prev: SiteSettingsState, formData: FormData): Promise<SiteSettingsState> {
  const admin = await assertAdmin();
  const parsed = parseFormData(SiteSettingsSchema, formData, { arrayFields: SITE_SETTINGS_ARRAY_FIELDS });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SiteSettingsField, string>> = {};
    for (const [key, messages] of Object.entries(parsed.fieldErrors)) {
      const field = (key === 'hoursDays' || key === 'hoursTime' ? 'hours' : key) as SiteSettingsField;
      if (messages?.[0]) fieldErrors[field] ??= messages[0];
    }
    return { status: 'error', message: 'Some fields need attention.', fieldErrors };
  }
  const data = parsed.data;

  try {
    const before = await readSiteContact();
    await prisma.$transaction([
      prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }),
      prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SiteSettings',
          entityId: '1',
          changes: changesFrom(before, data) as Prisma.InputJsonValue,
          actorId: admin.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('saveSiteSettings failed:', error);
    return { status: 'error', message: "The settings couldn't be saved. Try again in a moment.", fieldErrors: {} };
  }

  updateTag(SITE_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  return { status: 'saved', message: 'Site settings saved. The site shows them now.', savedAt: Date.now() };
}

/** { phone: { from, to } } for the fields that changed. */
function changesFrom(before: Awaited<ReturnType<typeof readSiteContact>>, after: Prisma.SiteSettingsCreateInput) {
  const was = {
    contactEmail: before.contactEmail,
    phone: before.phone,
    whatsapp: before.whatsapp,
    officeAddress: before.officeLines.join('\n'),
    openingHours: before.hours,
    replyTime: before.replyTime,
    alertEmails: before.alertEmails.join(', ') || null,
  };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, from] of Object.entries(was)) {
    const to = after[key as keyof typeof after] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}
