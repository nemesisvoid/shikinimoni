import { Button, Section, Text } from '@react-email/components';
import { EmailLayout, buttonStyle, colors, text } from './layout';

/**
 * One short message with an optional note and one button. Used for agent
 * invites, "submitted for review" alerts and review outcomes.
 */
export type NoticeEmailProps = {
  preview: string;
  heading: string;
  paragraphs: string[];
  /** A quoted note, e.g. the admin's reason for sending a listing back. */
  note?: { label: string; text: string } | null;
  button: { label: string; href: string };
  /** Small print under the button. */
  footnote?: string;
  address: string;
};

export default function NoticeEmail({ preview, heading, paragraphs, note, button, footnote, address }: NoticeEmailProps) {
  return (
    <EmailLayout
      preview={preview}
      address={address}>
      <Text style={text.heading}>{heading}</Text>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={text.body}>
          {p}
        </Text>
      ))}
      {note && (
        <Section style={{ backgroundColor: colors.plumTint, borderRadius: 12, padding: '14px 16px', margin: '0 0 20px' }}>
          <Text style={text.label}>{note.label}</Text>
          <Text style={{ ...text.body, margin: 0, whiteSpace: 'pre-line' }}>{note.text}</Text>
        </Section>
      )}
      <Button
        href={button.href}
        style={buttonStyle}>
        {button.label}
      </Button>
      {footnote && <Text style={{ ...text.muted, margin: '20px 0 0' }}>{footnote}</Text>}
    </EmailLayout>
  );
}

NoticeEmail.PreviewProps = {
  preview: 'You’re invited to list properties on ShikiniMoni',
  heading: 'Join ShikiniMoni as an agent',
  paragraphs: ['Hi Tunde,', 'Ada has invited you to add listings to ShikiniMoni. Create your account with the button below.'],
  button: { label: 'Create your agent account', href: 'https://shikinimoni.com/join/example' },
  footnote: 'This link works once and expires on 27 November. If you weren’t expecting it, you can ignore this email.',
  address: 'Lekki Phase 1, Lagos',
} satisfies NoticeEmailProps;
