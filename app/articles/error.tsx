'use client';

import { SiteShell } from '@/components/site-shell';

export default function ArticleError({ reset }: { reset: () => void }) {
  return (
    <SiteShell>
      <main id="main" className="page-shell article-page" role="alert">
        <section className="page-intro">
          <h1>Article temporarily unavailable</h1>
          <p>Published content could not be loaded. Please try again.</p>
          <button className="button button-primary" onClick={reset} type="button">
            Try again
          </button>
        </section>
      </main>
    </SiteShell>
  );
}
