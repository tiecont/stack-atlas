import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.E2E_API_PORT ?? 3011);
const article = JSON.parse(
  readFileSync(
    new URL('../../tests/fixtures/public-content/types-zero-values.json', import.meta.url),
    'utf8',
  ),
);
const kubernetesArticle = {
  ...article,
  contentId: '00000000-0000-4000-8000-000000000005',
  contentKey: 'article:k8s-local-kind-cluster',
  slug: 'articles/kubernetes/local-kind-cluster',
  publishedRevisionId: '00000000-0000-4000-8000-000000000006',
  document: {
    schema_version: 1,
    title: 'Tạo Kubernetes lab cluster local bằng kind',
    description: 'A repeatable local Kubernetes cluster.',
    blocks: [
      {
        id: 'version-matrix-link',
        type: 'rich_text',
        version: 1,
        props: {
          nodes: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  href: '/labs/kubernetes-cluster/files/version-matrix.yaml',
                  children: [{ type: 'text', text: 'Version matrix' }],
                },
              ],
            },
          ],
        },
      },
    ],
  },
  seo: {
    title: 'Tạo Kubernetes lab cluster local bằng kind',
    description: 'A repeatable local Kubernetes cluster.',
  },
};
const searchItems = [
  {
    contentId: article.contentId,
    contentKey: article.contentKey,
    contentType: article.contentType,
    slug: article.slug,
    publishedRevisionId: article.publishedRevisionId,
    title: article.document.title,
    description: article.document.description,
    publishedAt: article.publishedAt,
  },
  {
    contentId: '00000000-0000-4000-8000-000000000003',
    contentKey: 'article:data-ownership',
    contentType: 'article',
    slug: 'articles/architecture/data-ownership',
    publishedRevisionId: '00000000-0000-4000-8000-000000000004',
    title: 'Data Ownership',
    description: 'Clear ownership boundaries for distributed systems.',
    publishedAt: '2026-09-30T00:00:00.000Z',
  },
];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok"}');
    return;
  }

  if (url.pathname === '/api/v1/content/search') {
    const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
    const items = searchItems.filter((item) =>
      `${item.title} ${item.description}`.toLocaleLowerCase().includes(query),
    );
    response.writeHead(200, {
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      'content-type': 'application/json',
    });
    response.end(JSON.stringify({ items }));
    return;
  }

  const prefix = '/api/v1/content/';
  if (url.pathname.startsWith(prefix)) {
    let slug;
    try {
      slug = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      response.writeHead(400, { 'content-type': 'application/problem+json' });
      response.end('{"type":"about:blank","title":"Bad request","status":400}');
      return;
    }

    if (slug === 'articles/golang/upstream-failure') {
      response.writeHead(503, { 'content-type': 'application/problem+json' });
      response.end('{"type":"about:blank","title":"Unavailable","status":503}');
      return;
    }
    if (slug === article.slug || slug === kubernetesArticle.slug) {
      const publishedArticle = slug === article.slug ? article : kubernetesArticle;
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      });
      response.end(JSON.stringify(publishedArticle));
      return;
    }
  }

  response.writeHead(404, { 'content-type': 'application/problem+json' });
  response.end('{"type":"about:blank","title":"Not found","status":404}');
});

server.listen(port, '127.0.0.1');
