import styles from '../admin-content.module.css';
import type { ContentStatus } from '../admin-content.service';

const labels: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const statusClasses: Record<ContentStatus, string> = {
  DRAFT: styles.statusDraft,
  IN_REVIEW: styles.statusReview,
  PUBLISHED: styles.statusPublished,
  ARCHIVED: styles.statusArchived,
};

export function contentStatusText(status: ContentStatus): string {
  return labels[status];
}

export function ContentStatusLabel({ status }: { status: ContentStatus }) {
  return (
    <span className={`${styles.status} ${statusClasses[status]}`}>{contentStatusText(status)}</span>
  );
}
