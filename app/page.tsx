import Link from 'next/link';
import { ArticleGrid, PathGrid, TopicGrid } from '@/features/content/components/content';
import { ContinueLearning } from '@/features/progress/components/learning-progress';
import { SearchTrigger } from '@/features/search/components/search-dialog';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog } from '@/lib/content/loader';
import type { Metadata } from 'next';
import { sitePath } from '@/lib/site-path';

export const metadata: Metadata = {
  title: { absolute: 'Stack Atlas' },
  description: 'Engineering knowledge, from code to infrastructure.',
  openGraph: {
    title: 'Stack Atlas',
    description: 'Engineering knowledge, from code to infrastructure.',
    type: 'website',
  },
};

export default function HomePage() {
  const catalog = loadCatalog();
  const articlesByTopic = new Map<string, number>();
  for (const article of catalog.articles)
    articlesByTopic.set(article.domain, (articlesByTopic.get(article.domain) ?? 0) + 1);
  const topics = catalog.topics.filter(
    (topic) => articlesByTopic.has(topic.id) || topic.status === 'planned',
  );
  const recent = [...catalog.articles]
    .filter((article) => article.updated_at)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 8);
  const pathsForProgress = catalog.paths.map((learningPath) => ({
    id: learningPath.id,
    title: learningPath.title,
    url: `/paths/${learningPath.id}/`,
    articles: learningPath.modules.flatMap((module) =>
      module.articles.map((article) => ({
        id: article.id,
        title: article.title,
        url: `${article.url}?path=${encodeURIComponent(learningPath.id)}`,
      })),
    ),
  }));
  const articleCount = catalog.articles.length;
  const topicCount = catalog.topics.filter((topic) => articlesByTopic.has(topic.id)).length;
  const moduleCount = catalog.paths.reduce(
    (sum, learningPath) => sum + learningPath.modules.length,
    0,
  );

  return (
    <SiteShell>
      <main id="main">
        <section className="hero-wrap">
          <div className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="status-dot" /> Engineering Knowledge Base
              </span>
              <h1>
                Engineering knowledge,
                <br />
                <em>from code to infrastructure.</em>
              </h1>
              <p>
                Explore practical articles, deep dives and structured learning paths across the
                systems engineers build and run.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href={sitePath('/topics/')}>
                  Explore topics <span aria-hidden="true">→</span>
                </Link>
                <SearchTrigger>
                  Search the Atlas <kbd>/</kbd>
                </SearchTrigger>
              </div>
              <div className="hero-proof">
                <span>
                  <strong>{articleCount}</strong> articles
                </span>
                <span>
                  <strong>{topicCount}</strong> topics with content
                </span>
                <span>
                  <strong>{moduleCount}</strong> learning modules
                </span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit-core">
                <span className="core-symbol">S</span>
                <b>
                  STACK
                  <br />
                  ATLAS
                </b>
              </div>
              <span className="orbit-node node-code">{'{{'}</span>
              <span className="orbit-node node-data">DB</span>
              <span className="orbit-node node-cloud">☁</span>
              <span className="orbit-node node-ops">⌘</span>
              <span className="orbit-caption">one map · many routes</span>
            </div>
          </div>
        </section>
        <section className="section section-soft" id="topics">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Explore the Atlas</span>
              <h2>Explore by topic</h2>
              <p>Find knowledge by the technology or engineering subject you want to understand.</p>
            </div>
            <Link className="text-link" href={sitePath('/topics/')}>
              All topics <span aria-hidden="true">→</span>
            </Link>
          </div>
          <TopicGrid topics={topics} counts={articlesByTopic} />
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Curated routes</span>
              <h2>Learning paths</h2>
              <p>Study selected articles in an order that builds useful mental models.</p>
            </div>
            <Link className="text-link" href={sitePath('/paths/')}>
              All paths <span aria-hidden="true">→</span>
            </Link>
          </div>
          <PathGrid
            paths={catalog.paths.filter((learningPath) => learningPath.status === 'published')}
          />
        </section>
        <section className="section section-soft" id="latest">
          <div className="section-heading">
            <div>
              <span className="eyebrow">From the library</span>
              <h2>Recently updated</h2>
              <p>Articles appear here after their update date is recorded.</p>
            </div>
            <Link className="text-link" href={sitePath('/articles/')}>
              Browse all {articleCount} articles <span aria-hidden="true">→</span>
            </Link>
          </div>
          {recent.length ? (
            <ArticleGrid articles={recent} catalog={catalog} />
          ) : (
            <p className="empty-state">No article update dates have been recorded yet.</p>
          )}
        </section>
        <ContinueLearning paths={pathsForProgress} />
      </main>
    </SiteShell>
  );
}
