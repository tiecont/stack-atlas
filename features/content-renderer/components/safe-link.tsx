import Link from 'next/link';
import type { ReactNode } from 'react';
import { resolveSafeHref } from '../safe-url';
import { sitePath } from '@/lib/site-path';

export { resolveSafeHref } from '../safe-url';

export function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  const safe = resolveSafeHref(href);
  if (!safe) return <>{children}</>;
  if (!safe.external) return <Link href={sitePath(safe.href)}>{children}</Link>;

  return (
    <a href={safe.href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}
