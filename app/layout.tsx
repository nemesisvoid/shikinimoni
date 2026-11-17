import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Manrope } from 'next/font/google';
import './globals.css';
import { siteConfig } from '@/lib/site';
import { cn } from '@/lib/utils';

const manropeHeading = Manrope({ subsets: ['latin'], variable: '--font-heading' });

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

/** Site-wide defaults. Pages set their own title (the template adds the name) and description. */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} | ${siteConfig.tagline}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: ['property for sale in Nigeria', 'land for sale', 'houses for rent', 'Lagos real estate', 'Abuja real estate', 'C of O'],
  openGraph: { type: 'website', siteName: siteConfig.name, locale: 'en_NG' },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#7D0073',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='en'
      className={cn('h-full', 'antialiased', 'font-sans', notoSans.variable, manropeHeading.variable)}>
      <body className='min-h-full flex flex-col'>{children}</body>
    </html>
  );
}
