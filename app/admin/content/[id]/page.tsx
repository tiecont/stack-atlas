import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';
import { AdminContentDetail } from '@/features/admin-content/components/admin-content-detail';

export const metadata: Metadata = {
  title: 'Content detail',
  robots: { index: false, follow: false },
};

export default async function AdminContentDetailPage({
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
        { label: 'Detail' },
      ]}
    >
      <main className="admin-main"><AdminContentDetail contentId={id} /></main>
    </AdminShell>
  );
}
