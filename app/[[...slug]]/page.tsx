import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { readGeneratedPage } from '@/lib/generated-site';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug?: string[] }> };

async function getPage(params: PageProps['params']) {
  const { slug = [] } = await params;
  return readGeneratedPage(slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPage(params);
  if (!page) return { title: 'Not found' };
  return { title: { absolute: page.title }, description: page.description };
}

export default async function GeneratedContentPage({ params }: PageProps) {
  const page = await getPage(params);
  if (!page) notFound();
  if (page.redirectTo) redirect(page.redirectTo);

  const body = page.body.replace(
    /(<nav\b[^>]*id="primary-nav"[^>]*>[\s\S]*?)(<\/nav>)/i,
    '$1<a href="/login">Sign in</a>$2',
  );
  return <div className="generated-page" dangerouslySetInnerHTML={{ __html: body }} />;
}
