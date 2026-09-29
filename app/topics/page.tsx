import type { Metadata } from 'next';
import { SiteShell } from '@/components/site-shell';
import { Breadcrumbs, TopicGrid } from '@/features/content/components/content';
import { loadCatalog } from '@/lib/content/loader';

export const metadata: Metadata = {
  title: 'Topics',
  description: 'Browse engineering topics in Stack Atlas.',
};

export default function TopicsPage() {
  const catalog = loadCatalog();
  const counts = new Map<string, number>();
  for (const article of catalog.articles)
    counts.set(article.domain, (counts.get(article.domain) ?? 0) + 1);
  const topics = catalog.topics.filter(
    (topic) => counts.has(topic.id) || topic.status === 'planned',
  );
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs items={[{ label: 'Topics' }]} />
        <header className="page-intro">
          <span className="eyebrow">Explore the Atlas</span>
          <h1>Topics</h1>
          <p>
            Browse engineering knowledge by domain. Each topic page gathers its articles, categories
            and learning paths.
          </p>
        </header>
        <TopicGrid topics={topics} counts={counts} large />
      </main>
    </SiteShell>
  );
}
