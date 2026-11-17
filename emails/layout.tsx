import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from '@react-email/components';
import { siteConfig } from '@/lib/site';

/**
 * Shared frame for every email: plain white card, the wordmark in text (images
 * are often blocked by mail apps), and a short footer. Colours are the brand's
 * hex values; email clients don't support CSS variables.
 */
export const colors = {
  plum: '#7D0073',
  plumTint: '#FBF3FA',
  ink: '#241F2D',
  muted: '#625A6E',
  border: '#E8E3EC',
  page: '#F7F5F8',
  azureTint: '#EEF8FD',
  azureText: '#1D5A75',
};

const font =
  "'Manrope', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function EmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang='en'>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.page, margin: 0, padding: '32px 12px', fontFamily: font, color: colors.ink }}>
        <Container style={{ maxWidth: 560, margin: '0 auto' }}>
          <Text style={{ margin: '0 0 16px 4px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: colors.plum }}>
            {siteConfig.name}
          </Text>
          <Section
            style={{
              backgroundColor: '#FFFFFF',
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: '28px 28px 24px',
            }}>
            {children}
          </Section>
          <Hr style={{ borderColor: 'transparent', margin: '8px 0' }} />
          <Text style={{ margin: '0 4px', fontSize: 12, lineHeight: '18px', color: colors.muted }}>
            {siteConfig.name} · {siteConfig.office.lines.join(', ')} ·{' '}
            <Link
              href={siteConfig.url}
              style={{ color: colors.muted, textDecoration: 'underline' }}>
              {siteConfig.url.replace(/^https?:\/\//, '')}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const text = {
  heading: { margin: '0 0 8px', fontSize: 22, lineHeight: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: colors.ink },
  body: { margin: '0 0 16px', fontSize: 15, lineHeight: '24px', color: colors.ink },
  muted: { margin: '0 0 16px', fontSize: 14, lineHeight: '22px', color: colors.muted },
  label: { margin: '0 0 2px', fontSize: 12, lineHeight: '18px', color: colors.muted },
  value: { margin: '0 0 14px', fontSize: 15, lineHeight: '22px', color: colors.ink, fontWeight: 600 },
} as const;

export const buttonStyle = {
  display: 'inline-block',
  backgroundColor: colors.plum,
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 700,
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: 999,
} as const;
