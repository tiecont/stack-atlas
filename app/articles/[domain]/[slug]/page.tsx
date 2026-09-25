import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleContent } from '@/features/content/components/article-content';
import {
  ArticleHeader,
  ArticleNavigation,
  ArticleTableOfContents,
  Breadcrumbs,
  PrerequisiteList,
  RelatedContent,
} from '@/features/content/components/content';
import { ArticlePathTracker } from '@/features/progress/components/learning-progress';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog, pathSequence } from '@/lib/content/loader';
import { canonicalUrl } from '@/lib/content/urls';
import { sitePath } from '@/lib/site-path';

type Props = {
  params: Promise<{ domain: string; slug: string }>;
  searchParams: Promise<{ path?: string }>;
};

function articleFor(domain: string, slug: string) {
  const url = `/articles/${domain}/${slug}/`;
  return loadCatalog().articleByUrl.get(url);
}

export function generateStaticParams() {
  return loadCatalog().articles.map((article) => {
    const [, , domain, slug] = article.url.split('/');
    return { domain, slug };
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain, slug } = await params;
  const article = articleFor(domain, slug);
  if (!article) return { title: 'Not found' };
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: canonicalUrl(article.url) },
    openGraph: { title: article.title, description: article.description, type: 'article' },
  };
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const [{ domain, slug }, query] = await Promise.all([params, searchParams]);
  const catalog = loadCatalog();
  const article = articleFor(domain, slug);
  if (!article) notFound();
  const topic = catalog.topicById.get(article.domain);
  const category = catalog.categoryById.get(article.category ?? '');
  const prerequisites = article.prerequisites
    .map((id) => catalog.articleById.get(id))
    .filter((item) => !!item);
  const related = article.related.map((id) => catalog.articleById.get(id)).filter((item) => !!item);
  const membershipPaths = article.learning_paths
    .map((item) => ({ membership: item, path: catalog.pathById.get(item.path_id) }))
    .filter((item) => !!item.path);
  const selected = query.path
    ? membershipPaths.find((item) => item.membership.path_id === query.path)
    : undefined;
  const selectedPath = selected?.path;
  const selectedModule = selectedPath?.modules.find(
    (module) => module.id === selected?.membership.module_id,
  );
  const selectedSequence = selectedPath ? pathSequence(selectedPath) : [];
  const position = selectedSequence.findIndex((item) => item.id === article.id);
  const previous = position > 0 ? selectedSequence[position - 1] : undefined;
  const next = position >= 0 ? selectedSequence[position + 1] : undefined;
  const reviewed = article.review?.last_reviewed;
  const statusDate = article.updated_at ?? reviewed;
  const statusLabel = article.updated_at ? 'Updated' : 'Reviewed';
  const difficulty = article.difficulty === 'unspecified' ? '' : article.difficulty;
  const eyebrow = [
    topic?.title ?? article.domain,
    category?.title ?? article.category,
    difficulty && difficulty[0].toUpperCase() + difficulty.slice(1),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SiteShell>
      <main id="main" className="page-shell article-page" data-article-id={article.id}>
        <Breadcrumbs
          items={[
            { label: topic?.title ?? article.domain, href: `/topics/${article.domain}/` },
            ...(category
              ? [
                  {
                    label: category.title,
                    href: `/topics/${article.domain}/#category-${article.category}`,
                  },
                ]
              : []),
            { label: article.title },
          ]}
        />
        <ArticleHeader
          articleId={article.id}
          eyebrow={eyebrow}
          title={article.title}
          description={article.description}
          topic={topic?.title ?? article.domain}
          statusDate={statusDate}
          statusLabel={statusLabel}
        />
        <div className="article-layout">
          <aside className="article-sidebar">
            <ArticleTableOfContents headings={article.headings} />
            {selectedPath && selectedModule ? (
              <>
                <ArticlePathTracker pathId={selectedPath.id} articleId={article.id} />
                <Link className="path-context" href={sitePath(`/paths/${selectedPath.id}/`)}>
                  <span>Part of {selectedPath.title}</span>
                  <strong>
                    {selectedModule.title} · Lesson{' '}
                    {String(
                      selectedModule.articles.findIndex((item) => item.id === article.id) + 1,
                    ).padStart(2, '0')}
                  </strong>
                </Link>
              </>
            ) : (
              membershipPaths.length > 0 && (
                <section className="article-path-memberships">
                  <strong>Appears in</strong>
                  <div>
                    {membershipPaths.map(({ membership, path }) => (
                      <Link
                        className="related-link"
                        href={sitePath(
                          `${article.url}?path=${encodeURIComponent(membership.path_id)}`,
                        )}
                        key={`${membership.path_id}:${membership.module_id}`}
                      >
                        {path!.title}
                        {membershipPaths.length > 1
                          ? ` · ${path!.modules.find((module) => module.id === membership.module_id)?.title ?? ''}`
                          : ''}
                      </Link>
                    ))}
                  </div>
                </section>
              )
            )}
          </aside>
          <article className="article-body">
            <ArticleContent html={article.bodyHtml} />
            {article.labs.length > 0 && (
              <section className="article-related">
                <h2>Hands-on Labs</h2>
                <div>
                  {article.labs.map((lab) => (
                    <a className="related-link" href={sitePath(`/labs/${lab}/README.md`)} key={lab}>
                      Open {lab.split('/').at(-1)?.replaceAll('-', ' ')} lab guide
                    </a>
                  ))}
                </div>
              </section>
            )}
            <PrerequisiteList articles={prerequisites} />
            <RelatedContent articles={related} />
            {selectedPath && (
              <ArticleNavigation pathId={selectedPath.id} previous={previous} next={next} />
            )}
          </article>
        </div>
      </main>
    </SiteShell>
  );
}
