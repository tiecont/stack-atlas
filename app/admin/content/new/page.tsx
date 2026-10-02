import type { Metadata } from 'next';
import { AdminShell } from '@/features/administration/components/admin-shell';
import { AdminContentCreateForm } from '@/features/admin-content/components/admin-content-create-form';

export const metadata: Metadata = {
  title: 'New content',
  robots: { index: false, follow: false },
};

export default function NewAdminContentPage() {
  return (
    <AdminShell
      activeItem="content"
      breadcrumbs={[
        { label: 'Overview', href: '/admin/' },
        { label: 'Content', href: '/admin/content/' },
        { label: 'New' },
      ]}
    >
      <main className="admin-main"><AdminContentCreateForm /></main>
    </AdminShell>
  );
}
