import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleGrid, Breadcrumbs } from '@/features/content/components/content';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog } from '@/lib/content/loader';
import { canonicalUrl } from '@/lib/content/urls';

type Props = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return loadCatalog().topics.map((topic) => ({ topic: topic.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic: id } = await params;
  const topic = loadCatalog().topicById.get(id);
  if (!topic) return { title: 'Not found' };
  return {
    title: topic.title,
    description: topic.description,
    alternates: { canonical: canonicalUrl(`/topics/${topic.id}/`) },
    openGraph: { title: topic.title, description: topic.description, type: 'website' },
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic: id } = await params;
  const catalog = loadCatalog();
  const topic = catalog.topicById.get(id);
  if (!topic) notFound();
  const articles = catalog.articles.filter((article) => article.domain === id);
  const pathItems = catalog.paths.filter((learningPath) =>
    learningPath.modules.some((pathModule) => pathModule.domain === id),
  );
  const categoryIds = [
    ...new Set(
      articles.map((article) => article.category).filter((value): value is string => !!value),
    ),
  ];
  const pathLabel = pathItems.length === 1 ? 'Learning Path' : 'Learning Paths';
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs items={[{ label: 'Topics', href: '/topics/' }, { label: topic.title }]} />
        <header className="topic-hero">
          <span className="topic-mark topic-mark-large">{topic.title.slice(0, 1)}</span>
          <div>
            <span className="eyebrow">
              {articles.length ? `${articles.length} articles in the library` : 'Planned topic'}
            </span>
            <h1>{topic.title}</h1>
            <p>{topic.description}</p>
          </div>
        </header>
        {pathItems.length > 0 && (
          <section className="topic-section">
            <h2>{pathLabel}</h2>
            <div className="inline-paths">
              {pathItems.map((learningPath) => (
                <Link
                  className="inline-path"
                  href={`/paths/${learningPath.id}/`}
                  key={learningPath.id}
                >
                  {learningPath.title} <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {categoryIds.length > 0 && (
          <section className="topic-section">
            <h2>Topics</h2>
            <div className="category-list">
              {categoryIds.map((categoryId) => (
                <a className="category-chip" href={`#category-${categoryId}`} key={categoryId}>
                  {catalog.categoryById.get(categoryId)?.title ?? categoryId}
                  <span>
                    {articles.filter((article) => article.category === categoryId).length}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
        {categoryIds.length ? (
          categoryIds.map((categoryId) => {
            const items = articles.filter((article) => article.category === categoryId);
            return (
              <section
                className="topic-article-group"
                id={`category-${categoryId}`}
                key={categoryId}
              >
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">Category</span>
                    <h2>{catalog.categoryById.get(categoryId)?.title ?? categoryId}</h2>
                  </div>
                  <span className="count-label">{items.length} articles</span>
                </div>
                <ArticleGrid articles={items} catalog={catalog} />
              </section>
            );
          })
        ) : articles.length ? (
          <ArticleGrid articles={articles} catalog={catalog} />
        ) : (
          <section className="empty-topic">
            <h2>Content is being prepared</h2>
            <p>This topic is ready for new articles and learning paths.</p>
            <Link className="text-link" href="/topics/">
              Explore other topics →
            </Link>
          </section>
        )}
      </main>
    </SiteShell>
  );
}
