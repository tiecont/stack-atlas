import Link from 'next/link';
import type { ReactNode } from 'react';

export function resolveSafeHref(href: string): { href: string; external: boolean } | null {
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) {
    try {
      const parsed = new URL(href, 'https://stack-atlas.invalid');
      if (parsed.origin === 'https://stack-atlas.invalid') return { href, external: false };
      return null;
    } catch {
      return null;
    }
  }
  if (href.startsWith('#')) return { href, external: false };

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    return { href: parsed.toString(), external: true };
  } catch {
    return null;
  }
}

export function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  const safe = resolveSafeHref(href);
  if (!safe) return <>{children}</>;
  if (!safe.external) return <Link href={safe.href}>{children}</Link>;

  return (
    <a href={safe.href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}
