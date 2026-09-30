import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';

export const metadata: Metadata = {
  title: 'Content',
  robots: { index: false, follow: false },
};

export default function AdminContentPage() {
  return (
    <AdminShell
      activeItem="content"
      breadcrumbs={[{ label: 'Overview', href: '/admin/' }, { label: 'Content' }]}
    >
      <main className="admin-main">
        <span className="eyebrow">Authoring</span>
        <h1>Content</h1>
        <p className="admin-intro">
          Drafts and published revisions will be managed here once the API authoring surface is
          available.
        </p>
        <section className="admin-empty-card admin-empty-card-wide" aria-labelledby="content-empty-title">
          <span className="admin-empty-icon" aria-hidden="true">○</span>
          <div>
            <h2 id="content-empty-title">No API content is available</h2>
            <p>
              The Web app still reads public knowledge from the Git catalog. This page will list
              API managed content after the Content Platform foundation and authoring endpoints
              are ready.
            </p>
            <span className="admin-status-pill">Coming in a later phase</span>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
