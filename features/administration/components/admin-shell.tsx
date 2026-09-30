import type { ReactNode } from 'react';
import { AdminBreadcrumbs, type AdminBreadcrumb } from './admin-breadcrumbs';
import { AdminSidebar, type AdminNavigationItem } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export function AdminShell({
  activeItem,
  breadcrumbs,
  children,
}: {
  activeItem: AdminNavigationItem;
  breadcrumbs: readonly AdminBreadcrumb[];
  children: ReactNode;
}) {
  return (
    <div className="admin-platform">
      <AdminSidebar activeItem={activeItem} />
      <div className="admin-workspace">
        <AdminTopbar />
        <AdminBreadcrumbs items={breadcrumbs} />
        {children}
      </div>
    </div>
  );
}
