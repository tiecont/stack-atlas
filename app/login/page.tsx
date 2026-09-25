import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="auth-brand" href="/">Stack Atlas</a>
        <h1 id="login-title">Sign in</h1>
        <p className="auth-intro">Use your Stack Atlas account to continue.</p>
        <AuthForm mode="login" />
        <p className="auth-footnote">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
