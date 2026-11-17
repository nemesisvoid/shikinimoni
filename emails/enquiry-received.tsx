import { Button, Link, Section, Text } from '@react-email/components';
import { siteConfig } from '@/lib/site';
import { buttonStyle, colors, EmailLayout, text } from './layout';
import type { EnquiryEmailData } from './types';

/**
 * To the person who wrote in: confirms we have it and says what happens next.
 * It deliberately doesn't repeat their message, so the form can't be used to
 * send someone else arbitrary text from our domain.
 */
export default function EnquiryReceivedEmail({ enquiry: e }: { enquiry: EnquiryEmailData }) {
  const firstName = e.name.split(/\s+/)[0].slice(0, 40);
  const viewing = e.kind === 'viewing';
  const next = viewing
    ? `We'll call you${e.phone ? ` on ${e.phone}` : ''} to confirm a time${e.preferredDate ? ` close to ${e.preferredDate}` : ''}. Nobody needs to travel until it's confirmed.`
    : `Someone from our team will reply to this address ${siteConfig.replyTime}.`;

  return (
    <EmailLayout preview={viewing ? 'We got your inspection request.' : 'We got your message.'}>
      <Text style={text.heading}>
        Thanks, {firstName}. {viewing ? 'Your inspection request is in.' : 'We got your message.'}
      </Text>
      <Text style={text.body}>{next}</Text>

      {e.property && (
        <Section
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            margin: '4px 0 20px',
          }}>
          <Text style={{ ...text.label, margin: 0 }}>
            {e.property.ref} · {e.property.location}
          </Text>
          <Text style={{ margin: '2px 0 10px', fontSize: 16, fontWeight: 700, color: colors.ink }}>{e.property.name}</Text>
          <Button
            href={e.property.url}
            style={{ ...buttonStyle, padding: '10px 16px', fontSize: 13 }}>
            View the property
          </Button>
        </Section>
      )}

      <Section style={{ backgroundColor: colors.azureTint, borderRadius: 12, padding: '12px 16px', margin: '0 0 16px' }}>
        <Text style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: colors.azureText }}>
          Before you pay anything, ask to see the title documents and have a lawyer confirm them at the land registry.
        </Text>
      </Section>

      <Text style={{ ...text.muted, margin: 0 }}>
        Need us sooner? Call or WhatsApp{' '}
        <Link
          href={`tel:+${siteConfig.phone.replace(/\D/g, '')}`}
          style={{ color: colors.plum }}>
          {siteConfig.phone}
        </Link>
        {e.property ? ` and quote ${e.property.ref}.` : '.'}
      </Text>
    </EmailLayout>
  );
}

EnquiryReceivedEmail.PreviewProps = {
  enquiry: {
    kind: 'viewing',
    name: 'Chidinma Okafor',
    email: 'chidinma@example.com',
    phone: '0803 123 4567',
    message: 'Can I come on Saturday morning?',
    preferredDate: 'Saturday, 22 November',
    receivedAt: '17 Nov 2026, 2:15 pm',
    property: {
      name: '5-bedroom detached duplex with pool',
      ref: 'PRP-00001',
      location: 'Banana Island, Ikoyi, Lagos',
      url: 'http://localhost:3000/properties/5-bedroom-detached-duplex-banana-island',
    },
  },
} satisfies { enquiry: EnquiryEmailData };
