import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminShell } from '@/features/administration/components/admin-shell';

export const metadata: Metadata = {
  title: 'Admin workspace',
  robots: { index: false, follow: false },
};

export default function AdminHomePage() {
  return (
    <AdminShell activeItem="overview" breadcrumbs={[{ label: 'Overview' }]}>
      <main className="admin-main">
        <span className="eyebrow">Stack Atlas platform</span>
        <h1>Content workspace</h1>
        <p className="admin-intro">
          Manage Stack Atlas content in a workspace prepared for API backed authoring.
        </p>
        <section className="admin-empty-card" aria-labelledby="content-platform-heading">
          <span className="admin-empty-icon" aria-hidden="true">
            ▤
          </span>
          <div>
            <h2 id="content-platform-heading">Content Platform is not connected yet</h2>
            <p>
              This phase keeps the Git catalog as the learner source. Content lists and publishing
              will appear after the API authoring endpoints are available.
            </p>
            <Link className="admin-action-link" href="/admin/content/">
              View content status <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
