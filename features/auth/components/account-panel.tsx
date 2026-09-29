'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api/client';

type Account = { id: string; email: string; createdAt: string };

export function AccountPanel() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<Account>('account/me')
      .then((value) => {
        if (active) setAccount(value);
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        setError(cause instanceof Error ? cause.message : 'Your account could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api.post<null>('auth/logout');
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page">
      <nav className="account-topbar" aria-label="Account navigation">
        <Link className="auth-brand" href="/">
          Stack Atlas
        </Link>
        <button className="auth-button" disabled={busy || !account} onClick={logout} type="button">
          {busy ? 'Please wait…' : 'Sign out'}
        </button>
      </nav>
      <section className="account-card" aria-live="polite">
        <p className="eyebrow">Your account</p>
        <h1>{account ? 'Welcome back' : error ? 'Account unavailable' : 'Loading account…'}</h1>
        {account && <p className="account-email">{account.email}</p>}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {account && (
          <div className="account-links">
            <Link className="auth-back" href="/paths/">
              Browse learning paths
            </Link>
            <Link className="auth-back" href="/topics/">
              Explore topics
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
