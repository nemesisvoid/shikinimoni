import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site';

// The card shown when someone shares a page that has no photo of its own
// (home, search, contact). Property pages use their cover photo instead.
export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand colours from app/globals.css, as hex (the image renderer has no CSS variables).
const PLUM = '#7D0073';
const PLUM_50 = '#FBF3FA';
const INK = '#2A2433';
const MUTED = '#6B6275';
const AZURE = '#00AEEF';
const SUNSET = '#FF8B26';

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/brand/shikinimoni-logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: 'white', padding: 72 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 48 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img
            src={logoSrc}
            width={279}
            height={104}
            alt=''
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.04em', color: INK }}>
              Land and homes with papers you can trust.
            </div>
            <div style={{ marginTop: 28, fontSize: 30, color: MUTED }}>
              Title documents shown on every listing. Lagos, Abuja, Ogun.
            </div>
          </div>
        </div>
        {/* The logo's house: a plum-tinted silhouette under the two roof strokes. */}
        <svg
          width='380'
          height='486'
          viewBox='-12 0 124 120'>
          <polygon
            points='50,16 100,40 100,120 0,120 0,40'
            fill={PLUM_50}
          />
          <path
            d='M -8.5 28.7 L 28 6.8 L 43.5 15.5'
            fill='none'
            stroke={AZURE}
            strokeWidth={3}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
          <path
            d='M -3 44 L 50 12.2 L 103 44 Q 106 46 107.4 50.2'
            fill='none'
            stroke={SUNSET}
            strokeWidth={3.2}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
          <rect
            x='38'
            y='72'
            width='24'
            height='48'
            rx='3'
            fill={PLUM}
          />
        </svg>
      </div>
    ),
    size,
  );
}
