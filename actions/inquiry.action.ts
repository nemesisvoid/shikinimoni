'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { getCurrentUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { RATE_LIMITED_MESSAGE, tooManyRecentInquiries } from '@/lib/inquiries';
import { formDataToObject } from '@/schemas/form-data';
import { PropertyEnquirySchema, type EnquiryIntent } from '@/schemas/inquiry.schema';

type Field = 'intent' | 'name' | 'email' | 'phone' | 'preferredDate' | 'message';

/** What the property page's form shows after a submit. `values` refills the fields after an error. */
export type EnquiryFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<Field, string>>; values: Record<string, string> }
  | { status: 'sent'; intent: EnquiryIntent; name: string; email: string; preferredDate: string | null };

const FIELDS: Field[] = ['intent', 'name', 'email', 'phone', 'preferredDate', 'message'];

/**
 * Enquiry from a property page → an Inquiry linked to that listing: a viewing
 * request (with the preferred date) or a question. Works without JavaScript.
 */
export async function sendPropertyEnquiry(_prev: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  const raw = formDataToObject(formData);
  const values = Object.fromEntries(FIELDS.map(key => [key, typeof raw[key] === 'string' ? (raw[key] as string) : '']));

  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (typeof raw.company === 'string' && raw.company.trim() !== '') {
    return { status: 'sent', intent: 'question', name: values.name.trim() || 'there', email: values.email.trim(), preferredDate: null };
  }

  const parsed = PropertyEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    if (fieldErrors.propertyId) {
      return { status: 'error', message: 'This property is no longer listed.', fieldErrors: {}, values };
    }
    return {
      status: 'error',
      message: 'Check the highlighted fields and try again.',
      fieldErrors: Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0]])),
      values,
    };
  }
  const data = parsed.data;
  const preferredDate = data.intent === 'viewing' ? (data.preferredDate ?? null) : null;

  try {
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!property) {
      return { status: 'error', message: 'This property is no longer listed, so we can’t send this.', fieldErrors: {}, values };
    }
    if (await tooManyRecentInquiries(data.email)) {
      return { status: 'error', message: RATE_LIMITED_MESSAGE, fieldErrors: {}, values };
    }

    const user = await getCurrentUser().catch(() => null);
    await prisma.inquiry.create({
      data: {
        type: data.intent === 'viewing' ? 'VIEWING_REQUEST' : 'GENERAL',
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        message: data.message || 'I’d like to inspect this property.',
        // Midday in Lagos, so the date never shifts a day in another time zone.
        preferredViewingAt: preferredDate ? new Date(`${preferredDate}T12:00:00+01:00`) : null,
        propertyId: property.id,
        userId: user?.id ?? null,
      },
    });
  } catch (error) {
    console.error('sendPropertyEnquiry failed:', error);
    return {
      status: 'error',
      message: "Your enquiry didn't send. Try again in a moment, or call us instead.",
      fieldErrors: {},
      values,
    };
  }

  revalidatePath('/admin', 'layout'); // enquiry count in the admin sidebar
  return { status: 'sent', intent: data.intent, name: data.name.split(/\s+/)[0], email: data.email, preferredDate };
}
