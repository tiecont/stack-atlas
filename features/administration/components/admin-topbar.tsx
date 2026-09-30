import Link from 'next/link';

export function AdminTopbar() {
  return (
    <header className="admin-topbar">
      <span className="admin-mode-label">Content operations</span>
      <Link className="admin-account-link" href="/account/">
        Account
      </Link>
    </header>
  );
}
