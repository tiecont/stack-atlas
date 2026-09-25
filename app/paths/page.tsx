import type { Metadata } from 'next';
import { Breadcrumbs, PathGrid } from '@/features/content/components/content';
import { SiteShell } from '@/components/site-shell';
import { loadCatalog } from '@/lib/content/loader';

export const metadata: Metadata = {
  title: 'Learning Paths',
  description: 'Structured routes through engineering knowledge.',
};

export default function PathsPage() {
  const catalog = loadCatalog();
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs items={[{ label: 'Learning Paths' }]} />
        <header className="page-intro">
          <span className="eyebrow">Curated routes</span>
          <h1>Learning Paths</h1>
          <p>
            Follow a structured route or open any article on its own. Articles remain canonical
            knowledge nodes that can be reused across paths.
          </p>
        </header>
        <PathGrid paths={catalog.paths} />
      </main>
    </SiteShell>
  );
}
