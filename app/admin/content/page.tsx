import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';
import { AdminContentList } from '@/features/admin-content/components/admin-content-list';

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
      <main className="admin-main"><AdminContentList /></main>
    </AdminShell>
  );
}
