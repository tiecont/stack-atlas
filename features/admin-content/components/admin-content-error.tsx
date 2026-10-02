import Link from 'next/link';
import styles from '../admin-content.module.css';
import { describeAdminContentError } from '../admin-content-errors';

export function AdminContentError({
  error,
  action,
  onRetry,
}: {
  error: unknown;
  action: string;
  onRetry?: () => void;
}) {
  const view = describeAdminContentError(error, action);
  return (
    <section className={styles.errorState} role="alert">
      <h2>{view.title}</h2>
      <p>{view.message}</p>
      {(view.loginHref || onRetry) && (
        <div className={styles.errorActions}>
          {view.loginHref && (
            <Link className={styles.textLink} href={view.loginHref}>
              Sign in
            </Link>
          )}
          {onRetry && (
            <button className={styles.secondaryButton} onClick={onRetry} type="button">
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
