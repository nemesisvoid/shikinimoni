import 'server-only';
import EnquiryAlertEmail from '@/emails/enquiry-alert';
import EnquiryReceivedEmail from '@/emails/enquiry-received';
import type { EnquiryEmailData } from '@/emails/types';
import { prisma } from '@/lib/db';
import { locationLine } from '@/lib/listings/format';
import { formatRef, propertyPath } from '@/lib/listings/search';
import { siteConfig } from '@/lib/site';
import { readSiteContact } from '@/lib/site-settings';
import { sendEmail, teamRecipients } from './send';

const lagosDay = new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
const lagosStamp = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  hourCycle: 'h12',
  minute: '2-digit',
  timeZone: 'Africa/Lagos',
});

const SUBJECT_PREFIX: Record<EnquiryEmailData['kind'], string> = {
  viewing: 'Inspection request',
  question: 'Question',
  offer: 'Offer',
  contact: 'Contact form',
};

/**
 * Emails for a just-saved enquiry: an alert to the team (reply goes to the
 * sender) and a confirmation to the sender (reply goes to the team). Called
 * from after() in the form actions, so it never slows or fails the form.
 */
export async function sendEnquiryEmails(inquiryId: string) {
  try {
    await send(inquiryId);
  } catch (error) {
    console.error('Enquiry emails failed:', error);
  }
}

async function send(inquiryId: string) {
  const row = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      type: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      preferredViewingAt: true,
      createdAt: true,
      property: { select: { name: true, slug: true, refNumber: true, neighborhood: true, city: true, state: true } },
    },
  });
  if (!row) return;
  const contact = await readSiteContact();

  const kind: EnquiryEmailData['kind'] = !row.property
    ? 'contact'
    : row.type === 'VIEWING_REQUEST'
      ? 'viewing'
      : row.type === 'OFFER'
        ? 'offer'
        : 'question';

  const enquiry: EnquiryEmailData = {
    kind,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    preferredDate: row.preferredViewingAt ? lagosDay.format(row.preferredViewingAt) : null,
    receivedAt: lagosStamp.format(row.createdAt),
    property: row.property
      ? {
          name: row.property.name,
          ref: formatRef(row.property.refNumber),
          location: locationLine(row.property),
          url: `${siteConfig.url}${propertyPath(row.property.slug)}`,
        }
      : null,
    team: { phone: contact.phone, replyTime: contact.replyTime, address: contact.officeLines.join(', ') },
  };

  const team = teamRecipients(contact);
  const about = enquiry.property ? `${enquiry.property.name} (${enquiry.property.ref})` : enquiry.message.split('\n')[0].replace(/^About: /, '');

  await Promise.all([
    team.length > 0 &&
      sendEmail({
        to: team,
        subject: `${SUBJECT_PREFIX[kind]}: ${about} from ${enquiry.name}`,
        react: EnquiryAlertEmail({ enquiry, adminUrl: `${siteConfig.url}/admin/inquiries/${inquiryId}` }),
        replyTo: enquiry.email,
        idempotencyKey: `enquiry-alert/${inquiryId}`,
        category: 'enquiry-alert',
      }),
    sendEmail({
      to: enquiry.email,
      subject:
        kind === 'viewing'
          ? `We got your inspection request for ${enquiry.property?.name}`
          : enquiry.property
            ? `We got your question about ${enquiry.property.name}`
            : `We got your message, ${enquiry.name.split(/\s+/)[0].slice(0, 40)}`,
      react: EnquiryReceivedEmail({ enquiry }),
      replyTo: team[0],
      idempotencyKey: `enquiry-received/${inquiryId}`,
      category: 'enquiry-received',
    }),
  ]);
}
