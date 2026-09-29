import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/content/urls';
import { withBasePath } from '@/lib/content/urls';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteOrigin().replace(/\/$/, '')}${withBasePath('/sitemap.xml')}`,
  };
}
