import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';

/** /robots.txt: everything public is crawlable; the admin, account screens and APIs aren't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/auth', '/api'] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
