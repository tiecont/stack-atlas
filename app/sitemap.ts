import type { MetadataRoute } from 'next';
import { loadCatalog } from '@/lib/content/loader';
import { examples } from '@/lib/examples/registry';
import { labs } from '@/lib/labs/registry';
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
    ...labs.map((lab) => `/labs/${lab.id}/`),
    ...examples.map((example) => `/examples/${example.id}/`),
  ];
  const origin = siteOrigin().replace(/\/$/, '');
  return paths.map((url) => ({ url: `${origin}${withBasePath(url)}` }));
}
