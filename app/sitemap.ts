import type { MetadataRoute } from 'next';
import { getListingSitemap } from '@/lib/listings/queries';
import { LISTINGS_PATH, propertyPath } from '@/lib/listings/search';
import { siteConfig } from '@/lib/site';

/**
 * /sitemap.xml: the public pages plus every live listing. The listing query is
 * cached under the listings tag, so publishing or unpublishing updates it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await getListingSitemap();
  const latest = listings.reduce<Date | undefined>((max, l) => (!max || l.updatedAt > max ? l.updatedAt : max), undefined);

  return [
    { url: siteConfig.url, lastModified: latest, changeFrequency: 'daily', priority: 1 },
    { url: `${siteConfig.url}${LISTINGS_PATH}`, lastModified: latest, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteConfig.url}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    ...listings.map(l => ({
      url: `${siteConfig.url}${propertyPath(l.slug)}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
