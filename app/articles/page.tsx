import type { Metadata } from 'next';
import { Breadcrumbs, ArticleGrid } from '@/features/content/components/content';
import { SearchTrigger } from '@/features/search/components/search-dialog';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog } from '@/lib/content/loader';

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Articles and deep dives across the Stack Atlas engineering library.',
};

export default function ArticlesPage() {
  const catalog = loadCatalog();
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs items={[{ label: 'Articles' }]} />
        <header className="page-intro">
          <span className="eyebrow">Knowledge library</span>
          <h1>Articles</h1>
          <p>
            Standalone articles and learning-path lessons share one searchable library. Open any
            article directly or explore a curated route.
          </p>
          <div className="listing-search">
            <SearchTrigger>
              Search {catalog.articles.length} articles <kbd>/</kbd>
            </SearchTrigger>
          </div>
        </header>
        <ArticleGrid articles={[...catalog.articles].reverse()} catalog={catalog} list />
      </main>
    </SiteShell>
  );
}
