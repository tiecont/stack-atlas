import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArticleHeader,
  ArticleNavigation,
  ArticleTableOfContents,
  Breadcrumbs,
  PrerequisiteList,
  RelatedContent,
} from '@/features/content/components/content';
import { BlockRenderer, isContentBlock } from '@/features/content-renderer';
import { ArticlePathTracker } from '@/features/progress/components/learning-progress';
import { SiteShell } from '@/components/site-shell';
import {
  getPublishedContent,
  type PublishedContent,
} from '@/features/content/public-content.service';
import { loadCatalog, pathSequence } from '@/lib/content/loader';
import { canonicalUrl } from '@/lib/content/urls';
import { getLab } from '@/lib/labs/registry';
import { sitePath } from '@/lib/site-path';

type Props = {
  params: Promise<{ domain: string; slug: string }>;
  searchParams: Promise<{ path?: string }>;
};

function routeSlug(domain: string, slug: string): string {
  return `articles/${domain}/${slug}`;
}

function sourceArticleFor(content: PublishedContent, catalog: ReturnType<typeof loadCatalog>) {
  const sourceId = content.contentKey.startsWith('article:')
    ? content.contentKey.slice('article:'.length)
    : '';
  return catalog.articleById.get(sourceId) ?? catalog.articleByUrl.get(`/${content.slug}/`);
}

function documentHeadings(content: PublishedContent) {
  return content.document.blocks.flatMap((block) =>
    isContentBlock(block) && block.type === 'heading' && block.props.anchor
      ? [{ level: block.props.level, id: block.props.anchor, title: block.props.text }]
      : [],
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain, slug } = await params;
  const content = await getPublishedContent(routeSlug(domain, slug));
  if (!content) return { title: 'Not found' };
  const canonical = `/${content.slug}/`;
  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: { canonical: canonicalUrl(canonical) },
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      type: 'article',
    },
  };
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const [{ domain, slug }, query] = await Promise.all([params, searchParams]);
  const content = await getPublishedContent(routeSlug(domain, slug));
  if (!content) notFound();

  const catalog = loadCatalog();
  const article = sourceArticleFor(content, catalog);
  const topic = article ? catalog.topicById.get(article.domain) : undefined;
  const category = article ? catalog.categoryById.get(article.category ?? '') : undefined;
  const prerequisites = (article?.prerequisites ?? [])
    .map((id) => catalog.articleById.get(id))
    .filter((item) => !!item);
  const related = (article?.related ?? [])
    .map((id) => catalog.articleById.get(id))
    .filter((item) => !!item);
  const membershipPaths = (article?.learning_paths ?? []).flatMap((membership) => {
    const path = catalog.pathById.get(membership.path_id);
    return path ? [{ membership, path }] : [];
  });
  const selected = query.path
    ? membershipPaths.find((item) => item.membership.path_id === query.path)
    : undefined;
  const selectedPath = selected?.path;
  const selectedModule = selectedPath?.modules.find(
    (module) => module.id === selected?.membership.module_id,
  );
  const selectedSequence = selectedPath ? pathSequence(selectedPath) : [];
  const position = article ? selectedSequence.findIndex((item) => item.id === article.id) : -1;
  const previous = position > 0 ? selectedSequence[position - 1] : undefined;
  const next = position >= 0 ? selectedSequence[position + 1] : undefined;
  const difficulty = article?.difficulty === 'unspecified' ? '' : article?.difficulty;
  const topicTitle = topic?.title ?? article?.domain ?? domain;
  const eyebrow = [
    topicTitle,
    category?.title ?? article?.category,
    difficulty && difficulty[0].toUpperCase() + difficulty.slice(1),
  ]
    .filter(Boolean)
    .join(' · ');
  const articleId = article?.id ?? content.contentKey;
  const hasDocumentRelatedBlock = content.document.blocks.some(
    (block) => isContentBlock(block) && block.type === 'related_content',
  );

  return (
    <SiteShell>
      <main
        id="main"
        className="page-shell article-page"
        data-article-id={articleId}
        data-content-id={content.contentId}
      >
        <Breadcrumbs
          items={[
            ...(article
              ? [
                  {
                    label: topicTitle,
                    href: `/topics/${article.domain}/`,
                  },
                ]
              : [{ label: 'Articles', href: '/articles/' }]),
            ...(category && article
              ? [
                  {
                    label: category.title,
                    href: `/topics/${article.domain}/#category-${article.category}`,
                  },
                ]
              : []),
            { label: content.document.title },
          ]}
        />
        <ArticleHeader
          articleId={articleId}
          eyebrow={eyebrow || 'Article'}
          title={content.document.title}
          description={content.document.description}
          topic={topicTitle}
          statusDate={content.publishedAt.slice(0, 10)}
          statusLabel="Published"
        />
        <div className="article-layout">
          <aside className="article-sidebar">
            <ArticleTableOfContents headings={documentHeadings(content)} />
            {selectedPath && selectedModule ? (
              <>
                <ArticlePathTracker pathId={selectedPath.id} articleId={articleId} />
                <Link className="path-context" href={sitePath(`/paths/${selectedPath.id}/`)}>
                  <span>Part of {selectedPath.title}</span>
                  <strong>
                    {selectedModule.title} · Lesson{' '}
                    {String(
                      selectedModule.articles.findIndex((item) => item.id === article?.id) + 1,
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
                          `${article?.url ?? `/${content.slug}/`}?path=${encodeURIComponent(membership.path_id)}`,
                        )}
                        key={`${membership.path_id}:${membership.module_id}`}
                      >
                        {path.title}
                        {membershipPaths.length > 1
                          ? ` · ${path.modules.find((module) => module.id === membership.module_id)?.title ?? ''}`
                          : ''}
                      </Link>
                    ))}
                  </div>
                </section>
              )
            )}
          </aside>
          <article className="article-body">
            <BlockRenderer document={content.document} mode="public" />
            {(article?.labs.length ?? 0) > 0 && (
              <section className="article-related">
                <h2>Hands-on Labs</h2>
                <div>
                  {article?.labs.map((lab) => (
                    <a className="related-link" href={sitePath(`/labs/${lab}/`)} key={lab}>
                      Open {getLab(lab)?.title ?? lab} lab guide
                    </a>
                  ))}
                </div>
              </section>
            )}
            <PrerequisiteList articles={prerequisites} />
            {!hasDocumentRelatedBlock && <RelatedContent articles={related} />}
            {selectedPath && article && (
              <ArticleNavigation pathId={selectedPath.id} previous={previous} next={next} />
            )}
          </article>
        </div>
      </main>
    </SiteShell>
  );
}
