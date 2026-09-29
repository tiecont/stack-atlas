'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api } from '@/lib/api/client';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      if (mode === 'register') await api.post('account', credentials);
      await api.post('auth/login', credentials);
      router.replace('/account');
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError('An account with this email already exists.');
      } else if (cause instanceof ApiError && cause.status === 401) {
        setError('The email or password is incorrect.');
      } else if (cause instanceof ApiError && cause.status === 400) {
        setError(cause.problem.detail || 'Check your email and password, then try again.');
      } else {
        setError(cause instanceof Error ? cause.message : 'The request could not be completed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Email
        <input
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        Password
        <input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          maxLength={128}
          minLength={12}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="auth-button" disabled={busy} type="submit">
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
