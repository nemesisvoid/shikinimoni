import { Button, Link, Section, Text } from '@react-email/components';
import { whatsappNumber } from '@/lib/site';
import { buttonStyle, colors, EmailLayout, text } from './layout';
import type { EnquiryEmailData } from './types';

const HEADINGS: Record<EnquiryEmailData['kind'], string> = {
  viewing: 'New inspection request',
  question: 'New question about a property',
  offer: 'New offer on a property',
  contact: 'New message from the contact page',
};

/** To the team: who wrote, how to reach them, and what about. Replying answers the sender directly. */
export default function EnquiryAlertEmail({ enquiry: e, adminUrl }: { enquiry: EnquiryEmailData; adminUrl: string }) {
  const firstName = e.name.split(/\s+/)[0];
  return (
    <EmailLayout preview={`${e.name}: ${e.message.slice(0, 90)}`}>
      <Text style={text.heading}>{HEADINGS[e.kind]}</Text>
      <Text style={text.muted}>Received {e.receivedAt}. Reply to this email to answer {firstName} directly.</Text>

      {e.property && (
        <Section style={{ backgroundColor: colors.plumTint, borderRadius: 12, padding: '14px 16px', margin: '0 0 20px' }}>
          <Text style={{ ...text.label, margin: 0 }}>
            {e.property.ref} · {e.property.location}
          </Text>
          <Link
            href={e.property.url}
            style={{ fontSize: 16, fontWeight: 700, color: colors.plum, textDecoration: 'none' }}>
            {e.property.name}
          </Link>
        </Section>
      )}

      <Text style={text.label}>From</Text>
      <Text style={text.value}>{e.name}</Text>

      <Text style={text.label}>Email</Text>
      <Text style={text.value}>
        <Link
          href={`mailto:${e.email}`}
          style={{ color: colors.plum }}>
          {e.email}
        </Link>
      </Text>

      {e.phone && (
        <>
          <Text style={text.label}>Phone</Text>
          <Text style={text.value}>
            <Link
              href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}
              style={{ color: colors.plum }}>
              {e.phone}
            </Link>
            {'  ·  '}
            <Link
              href={`https://wa.me/${whatsappNumber(e.phone)}`}
              style={{ color: colors.plum }}>
              WhatsApp
            </Link>
          </Text>
        </>
      )}

      {e.preferredDate && (
        <>
          <Text style={text.label}>Preferred day</Text>
          <Text style={text.value}>{e.preferredDate}</Text>
        </>
      )}

      <Text style={text.label}>Message</Text>
      <Text style={{ ...text.body, whiteSpace: 'pre-wrap', borderLeft: `3px solid ${colors.border}`, paddingLeft: 12 }}>
        {e.message}
      </Text>

      <Button
        href={adminUrl}
        style={buttonStyle}>
        Open in the admin
      </Button>
    </EmailLayout>
  );
}

EnquiryAlertEmail.PreviewProps = {
  adminUrl: 'http://localhost:3000/admin/inquiries',
  enquiry: {
    kind: 'viewing',
    name: 'Chidinma Okafor',
    email: 'chidinma@example.com',
    phone: '0803 123 4567',
    message: 'Can I come on Saturday morning? I’d like to bring my lawyer to see the C of O.',
    preferredDate: 'Saturday, 22 November',
    receivedAt: '17 Nov 2026, 2:15 pm',
    property: {
      name: '5-bedroom detached duplex with pool',
      ref: 'PRP-00001',
      location: 'Banana Island, Ikoyi, Lagos',
      url: 'http://localhost:3000/properties/5-bedroom-detached-duplex-banana-island',
    },
  },
} satisfies { enquiry: EnquiryEmailData; adminUrl: string };
