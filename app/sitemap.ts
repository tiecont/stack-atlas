import type { MetadataRoute } from 'next';
import { loadCatalog } from '@/lib/content/loader';
import { siteOrigin, withBasePath } from '@/lib/content/urls';

export default function sitemap(): MetadataRoute.Sitemap {
  const catalog = loadCatalog();
  const paths = [
    '/',
    '/topics/',
    '/paths/',
    '/articles/',
    '/about/',
    ...catalog.topics.map((topic) => `/topics/${topic.id}/`),
    ...catalog.paths.map((learningPath) => `/paths/${learningPath.id}/`),
    ...catalog.articles.map((article) => article.url),
  ];
  const origin = siteOrigin().replace(/\/$/, '');
  return paths.map((url) => ({ url: `${origin}${withBasePath(url)}` }));
}
