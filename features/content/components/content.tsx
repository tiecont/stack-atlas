import Link from 'next/link';
import type { Article, Category, LearningPath, PathModule, Topic } from '@/lib/content/types';
import { sitePath } from '@/lib/site-path';
import { ProgressToggle } from '@/features/progress/components/learning-progress';

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return <div className="breadcrumbs"><Link href={sitePath('/')}>Stack Atlas</Link>{items.map((item, index) => <span key={`${item.label}-${index}`}>
    <span aria-hidden="true">/</span>{item.href ? <Link href={sitePath(item.href)}>{item.label}</Link> : item.label}
  </span>)}</div>;
}

export function TopicCard({ topic, count }: { topic: Topic; count: number }) {
  const status = topic.status === 'planned' ? 'Coming soon' : `${count} articles`;
  return <Link className="topic-card" href={sitePath(`/topics/${topic.id}/`)}><span className="topic-mark">{topic.title.slice(0, 1)}</span><span><strong>{topic.title}</strong><small>{status}</small></span><span className="arrow" aria-hidden="true">↗</span></Link>;
}

export function PathCard({ learningPath }: { learningPath: LearningPath }) {
  const count = learningPath.modules.reduce((sum, module) => sum + module.article_ids.length, 0);
  return <Link className="path-card" href={sitePath(`/paths/${learningPath.id}/`)}><span className="eyebrow">{(learningPath.status ?? 'published').replace(/^./, value => value.toUpperCase())} · Learning Path</span><h3>{learningPath.title}</h3><p>{learningPath.description}</p><span className="path-meta">{learningPath.modules.length} modules · {count} lessons</span><span className="text-link">View path <span aria-hidden="true">↗</span></span></Link>;
}

export function ArticleCard({ article, catalog }: { article: Article; catalog: { topicById: Map<string, Topic>; categoryById: Map<string, Category> } }) {
  const topic = catalog.topicById.get(article.domain)?.title ?? article.domain;
  const category = catalog.categoryById.get(article.category ?? '')?.title ?? article.category ?? '';
  return <article className="article-card"><Link href={sitePath(article.url)}><span className="card-kicker">{topic} · {category}</span><h3>{article.title}</h3><p>{article.description}</p><span className="text-link">Read article <span aria-hidden="true">↗</span></span></Link></article>;
}

export function TopicGrid({ topics, counts, large = false }: { topics: Topic[]; counts: Map<string, number>; large?: boolean }) {
  return <div className={`topic-grid${large ? ' topic-grid-large' : ''}`}>{topics.map(topic => <TopicCard key={topic.id} topic={topic} count={counts.get(topic.id) ?? 0} />)}</div>;
}

export function PathGrid({ paths }: { paths: LearningPath[] }) {
  return <div className="path-grid">{paths.map(learningPath => <PathCard key={learningPath.id} learningPath={learningPath} />)}</div>;
}

export function ArticleGrid({ articles, catalog, list = false }: { articles: Article[]; catalog: { topicById: Map<string, Topic>; categoryById: Map<string, Category> }; list?: boolean }) {
  return <div className={`article-grid${list ? ' article-grid-list' : ''}`}>{articles.map(article => <ArticleCard article={article} catalog={catalog} key={article.id} />)}</div>;
}

export function ArticleTableOfContents({ headings }: { headings: Article['headings'] }) {
  if (!headings.length) return null;
  return <nav className="article-toc" aria-label="On this page"><strong>On this page</strong>{headings.map(item => <a className={`toc-level-${item.level}`} href={`#${encodeURIComponent(item.id)}`} key={`${item.level}-${item.id}`}>{item.title}</a>)}</nav>;
}

export function ArticleHeader({
  articleId, eyebrow, title, description, topic, statusDate, statusLabel,
}: {
  articleId: string;
  eyebrow: string;
  title: string;
  description: string;
  topic: string;
  statusDate?: string;
  statusLabel: string;
}) {
  return <header className="article-header"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><div className="article-meta"><span>{topic}</span>{statusDate && <span>{statusLabel} {statusDate}</span>}<ProgressToggle articleId={articleId} /></div></header>;
}

export function ArticleNavigation({
  pathId, previous, next,
}: {
  pathId: string;
  previous?: Pick<Article, 'url' | 'title'>;
  next?: Pick<Article, 'url' | 'title'>;
}) {
  return <nav className="article-previous-next" aria-label="Learning path navigation">{previous ? <Link href={sitePath(`${previous.url}?path=${encodeURIComponent(pathId)}`)}><small>Previous</small><strong>{previous.title}</strong></Link> : <span />}{next ? <Link href={sitePath(`${next.url}?path=${encodeURIComponent(pathId)}`)}><small>Next</small><strong>{next.title}</strong></Link> : <span />}</nav>;
}

export function ModuleList({ modules, pathId, catalog }: { modules: PathModule[]; pathId: string; catalog: { topicById: Map<string, Topic>; categoryById: Map<string, Category> } }) {
  return <div className="path-content">{modules.map(pathModule => <section className="module-card" id={`module-${pathModule.id}`} key={pathModule.id}>
    <div className="module-heading"><div><span className="module-label">Module {String(pathModule.order).padStart(2, '0')} · {(catalog.topicById.get(pathModule.domain)?.title ?? pathModule.domain).replaceAll('-', ' ')}</span><h3>{pathModule.title}</h3><p>{pathModule.articles.length} lessons · {catalog.categoryById.get(pathModule.category)?.title ?? pathModule.category}</p></div><span className="module-count">{String(pathModule.order).padStart(2, '0')}</span></div>
    <div className="path-articles">{pathModule.articles.map((article, index) => {
      const href = article.learning_paths.some(item => item.path_id === pathId) ? `${article.url}?path=${encodeURIComponent(pathId)}` : article.url;
      return <div className="path-article" data-article-id={article.id} key={article.id}><Link className="path-article-link" href={sitePath(href)}><span className="article-number">{String(index + 1).padStart(2, '0')}</span><span className="article-copy"><strong>{article.title}</strong><span>{article.description}</span></span></Link><ProgressToggle articleId={article.id} /></div>;
    })}</div>
  </section>)}</div>;
}

export function PrerequisiteList({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return <section className="article-related"><h2>Before reading</h2><div>{articles.map(article => <Link className="related-link" href={sitePath(article.url)} key={article.id}>{article.title}</Link>)}</div></section>;
}

export function RelatedContent({ title = 'Related Articles', articles }: { title?: string; articles: Article[] }) {
  if (!articles.length) return null;
  return <section className="article-related"><h2>{title}</h2><div>{articles.map(article => <Link className="related-link" href={sitePath(article.url)} key={article.id}>{article.title}</Link>)}</div></section>;
}
