import Link from 'next/link';

export type AdminNavigationItem = 'overview' | 'content';

const items: { id: AdminNavigationItem; label: string; href: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', href: '/admin/', icon: '⌂' },
  { id: 'content', label: 'Content', href: '/admin/content/', icon: '▤' },
];

export function AdminSidebar({ activeItem }: { activeItem: AdminNavigationItem }) {
  return (
    <aside className="admin-sidebar" aria-label="Administration">
      <Link className="admin-brand" href="/admin/">
        <span aria-hidden="true">S</span>
        <span className="admin-brand-copy">
          Stack Atlas<small>Administration</small>
        </span>
      </Link>
      <p className="admin-sidebar-label">Workspace</p>
      <nav aria-label="Admin navigation">
        {items.map((item) => (
          <Link
            aria-current={activeItem === item.id ? 'page' : undefined}
            className={`admin-nav-link${activeItem === item.id ? ' is-active' : ''}`}
            href={item.href}
            key={item.id}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="admin-sidebar-note">
        Content access follows API permissions when authoring is enabled.
      </p>
    </aside>
  );
}
