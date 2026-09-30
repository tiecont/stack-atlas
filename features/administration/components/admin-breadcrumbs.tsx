import Link from 'next/link';

export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

export function AdminBreadcrumbs({ items }: { items: readonly AdminBreadcrumb[] }) {
  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href && index < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
