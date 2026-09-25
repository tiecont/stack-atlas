import Link from 'next/link';
import { SiteShell } from '@/components/site-shell';
import { sitePath } from '@/lib/site-path';

export default function NotFound() {
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <header className="page-intro">
          <span className="eyebrow">404 · Not found</span>
          <h1>This page isn’t in the Atlas.</h1>
          <p>The address may have changed or the page may no longer exist.</p>
          <Link className="button button-primary" href={sitePath('/')}>
            Return home
          </Link>
        </header>
      </main>
    </SiteShell>
  );
}
