import Link from 'next/link';
import type { ReactNode } from 'react';
import { LearningProgressProvider } from '@/features/progress/components/learning-progress';
import { SiteHeader } from '@/components/site-header';
import { sitePath } from '@/lib/site-path';

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <LearningProgressProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <footer className="site-footer">
        <div>
          <Link className="footer-brand" href={sitePath('/')}>
            Stack Atlas
          </Link>
          <span>Engineering knowledge, from code to infrastructure.</span>
        </div>
        <nav aria-label="Footer navigation">
          <Link href={sitePath('/topics/')}>Topics</Link>
          <Link href={sitePath('/paths/')}>Learning Paths</Link>
          <Link href={sitePath('/articles/')}>Articles</Link>
          <Link href={sitePath('/about/')}>About</Link>
        </nav>
        <small>Open engineering knowledge for curious builders.</small>
      </footer>
    </LearningProgressProvider>
  );
}
