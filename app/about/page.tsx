import type { Metadata } from 'next';
import { Breadcrumbs } from '@/features/content/components/content';
import { SiteShell } from '@/components/site-shell';

export const metadata: Metadata = {
  title: 'About',
  description: 'Stack Atlas is an engineering knowledge base and learning platform.',
};

export default function AboutPage() {
  return (
    <SiteShell>
      <main id="main" className="page-shell">
        <Breadcrumbs items={[{ label: 'About' }]} />
        <header className="page-intro">
          <span className="eyebrow">About Stack Atlas</span>
          <h1>
            Understand systems,
            <br />
            not just APIs.
          </h1>
          <p>
            Stack Atlas is an engineering knowledge base for people who build and operate software.
            Articles are the canonical units of knowledge; learning paths are optional routes
            through them.
          </p>
        </header>
        <section className="about-grid">
          <article className="info-card">
            <span className="eyebrow">The Atlas</span>
            <h2>One library, many domains</h2>
            <p>
              Explore programming languages, databases, infrastructure, reliability and system
              design from one place.
            </p>
          </article>
          <article className="info-card">
            <span className="eyebrow">Learning</span>
            <h2>Choose a route or roam</h2>
            <p>
              Follow a learning path when sequence helps. Read any standalone article when you
              already know what you need.
            </p>
          </article>
          <article className="info-card">
            <span className="eyebrow">Publishing</span>
            <h2>Versioned content</h2>
            <p>
              Pages render from versioned content and metadata. Search and learning progress work in
              the browser.
            </p>
          </article>
        </section>
      </main>
    </SiteShell>
  );
}
