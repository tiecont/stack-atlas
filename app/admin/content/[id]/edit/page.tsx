import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';
import { AdminContentEditor } from '@/features/admin-content/components/admin-content-editor';

export const metadata: Metadata = {
  title: 'Edit content',
  robots: { index: false, follow: false },
};

export default async function AdminContentEditorPage({
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
        { label: 'Edit' },
      ]}
    >
      <main className="admin-main"><AdminContentEditor contentId={id} /></main>
    </AdminShell>
  );
}
