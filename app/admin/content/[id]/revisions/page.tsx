import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';
import { AdminContentRevisions } from '@/features/admin-content/components/admin-content-revisions';

export const metadata: Metadata = {
  title: 'Revision history',
  robots: { index: false, follow: false },
};

export default async function AdminContentRevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminShell
      activeItem="content"
      breadcrumbs={[
        { label: 'Overview', href: '/admin/' },
        { label: 'Content', href: '/admin/content/' },
        { label: 'Revisions' },
      ]}
    >
      <main className="admin-main"><AdminContentRevisions contentId={id} /></main>
    </AdminShell>
  );
}
