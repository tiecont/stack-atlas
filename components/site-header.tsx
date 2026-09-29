'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { SearchDialog } from '@/features/search/components/search-dialog';
import { sitePath } from '@/lib/site-path';

function themeSnapshot(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
}

function subscribeTheme(listener: () => void): () => void {
  window.addEventListener('stack-atlas:theme-change', listener);
  return () => window.removeEventListener('stack-atlas:theme-change', listener);
}

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, themeSnapshot, () => false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('stack-atlas-theme') === 'dark';
      if (saved) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      window.dispatchEvent(new Event('stack-atlas:theme-change'));
    } catch {
      // Keep the default light theme when storage is unavailable.
    }
  }, []);
  const toggle = () => {
    const next = !dark;
    if (next) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    window.dispatchEvent(new Event('stack-atlas:theme-change'));
    try {
      window.localStorage.setItem('stack-atlas-theme', next ? 'dark' : 'light');
    } catch {
      // Theme still changes for this page view.
    }
  };
  return (
    <button
      className="theme-toggle"
      type="button"
      data-theme-toggle
      onClick={toggle}
      aria-label="Switch color theme"
    >
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href={sitePath('/')} aria-label="Stack Atlas home">
          <span className="brand-icon">S</span>
          <span>Stack Atlas</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((value) => !value)}
        >
          Menu
        </button>
        <nav
          className={`primary-nav${menuOpen ? ' is-open' : ''}`}
          id="primary-nav"
          aria-label="Main navigation"
        >
          <Link href={sitePath('/#topics')}>Explore</Link>
          <Link href={sitePath('/paths/')}>Learning Paths</Link>
          <Link href={sitePath('/topics/')}>Topics</Link>
          <Link href={sitePath('/articles/')}>Articles</Link>
          <SearchDialog />
          <Link href={sitePath('/login/')}>Sign in</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
