'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formDataToObject } from '@/schemas/form-data';
import { CONTACT_TOPICS, ContactMessageSchema, type ContactTopic } from '@/schemas/inquiry.schema';
import * as z from 'zod';

/** What the form shows after a submit. `values` refills the fields after an error. */
export type ContactFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      fieldErrors: Partial<Record<'name' | 'email' | 'phone' | 'topic' | 'message', string>>;
      values: Record<string, string>;
    }
  | { status: 'sent'; name: string; email: string };

/** A few messages per address in this window is plenty; more is usually a bot or a double-click. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

/**
 * Public contact form → an Inquiry (type GENERAL, no property) for the admin
 * Enquiries page. Works without JavaScript (plain form post) and with it
 * (useActionState).
 */
export async function sendContactMessage(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const raw = formDataToObject(formData);
  const values = Object.fromEntries(
    ['name', 'email', 'phone', 'topic', 'message'].map(key => [key, typeof raw[key] === 'string' ? (raw[key] as string) : '']),
  );

  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (typeof raw.company === 'string' && raw.company.trim() !== '') {
    return { status: 'sent', name: values.name.trim() || 'there', email: values.email.trim() };
  }

  const parsed = ContactMessageSchema.safeParse(raw);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: 'error',
      message: 'Check the highlighted fields and try again.',
      fieldErrors: Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0]])),
      values,
    };
  }
  const data = parsed.data;

  try {
    const recent = await prisma.inquiry.count({
      where: { email: data.email, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
    });
    if (recent >= RATE_LIMIT) {
      return {
        status: 'error',
        message: "We've already got your recent messages and will reply soon. If it's urgent, call or WhatsApp us.",
        fieldErrors: {},
        values,
      };
    }

    const user = await getCurrentUser().catch(() => null);
    await prisma.inquiry.create({
      data: {
        type: 'GENERAL',
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        message: `${topicLine(data.topic)}\n\n${data.message}`,
        userId: user?.id ?? null,
      },
    });
  } catch (error) {
    console.error('sendContactMessage failed:', error);
    return {
      status: 'error',
      message: "Your message didn't send. Try again in a moment, or email us instead.",
      fieldErrors: {},
      values,
    };
  }

  revalidatePath('/admin', 'layout'); // enquiry count in the admin sidebar
  return { status: 'sent', name: data.name.split(/\s+/)[0], email: data.email };
}

/** The first line of the stored message, so admins see the topic in the list. */
function topicLine(topic: ContactTopic) {
  return `About: ${CONTACT_TOPICS[topic]}`;
}
