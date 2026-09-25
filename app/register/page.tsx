import Link from 'next/link';
import { AuthForm } from '@/features/auth/components/auth-form';

export const metadata = { title: 'Create an account' };

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <Link className="auth-brand" href="/">
          Stack Atlas
        </Link>
        <h1 id="register-title">Create an account</h1>
        <p className="auth-intro">Create an account to sign in to Stack Atlas.</p>
        <AuthForm mode="register" />
        <p className="auth-footnote">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
