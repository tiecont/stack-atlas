'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  EMPTY_PROGRESS,
  normalizeProgress,
  readProgress,
  type LearningProgress,
} from '@/features/progress/progress-store';

type ProgressContextValue = {
  progress: LearningProgress;
  toggleComplete: (articleId: string) => void;
  setActivePath: (pathId: string) => void;
  recordVisit: (pathId: string, articleId: string) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);
const listeners = new Set<() => void>();
let cachedProgress: LearningProgress | undefined;

function getProgressSnapshot(): LearningProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;
  if (!cachedProgress) {
    try {
      cachedProgress = readProgress(window.localStorage);
    } catch {
      cachedProgress = EMPTY_PROGRESS;
    }
  }
  return cachedProgress;
}

function notifyProgress(): void {
  listeners.forEach((listener) => listener());
}

function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key &&
      event.key !== 'stack-atlas-progress-v1' &&
      event.key !== 'stack-atlas-progress-v2'
    )
      return;
    cachedProgress = undefined;
    getProgressSnapshot();
    notifyProgress();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function updateProgress(update: (current: LearningProgress) => LearningProgress): void {
  const next = normalizeProgress(update(getProgressSnapshot()));
  cachedProgress = next;
  try {
    window.localStorage.setItem('stack-atlas-progress-v2', JSON.stringify(next));
  } catch {
    /* In-memory progress remains usable if browser storage is unavailable. */
  }
  notifyProgress();
}

export function LearningProgressProvider({ children }: { children: ReactNode }) {
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    () => EMPTY_PROGRESS,
  );

  const toggleComplete = useCallback((articleId: string) => {
    updateProgress((current) => ({
      ...current,
      completed: current.completed.includes(articleId)
        ? current.completed.filter((id) => id !== articleId)
        : [...current.completed, articleId],
    }));
  }, []);
  const setActivePath = useCallback((pathId: string) => {
    updateProgress((current) => ({ ...current, activePath: pathId }));
  }, []);
  const recordVisit = useCallback((pathId: string, articleId: string) => {
    updateProgress((current) => ({
      ...current,
      activePath: pathId,
      lastVisited: { ...current.lastVisited, [pathId]: articleId },
    }));
  }, []);
  const value = useMemo(
    () => ({ progress, toggleComplete, setActivePath, recordVisit }),
    [progress, toggleComplete, setActivePath, recordVisit],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value)
    throw new Error('Learning progress components must be inside LearningProgressProvider.');
  return value;
}

export function ProgressToggle({ articleId }: { articleId: string }) {
  const { progress, toggleComplete } = useProgress();
  const complete = progress.completed.includes(articleId);
  return (
    <button
      className="complete-toggle"
      type="button"
      aria-pressed={complete}
      onClick={() => toggleComplete(articleId)}
    >
      {complete ? '✓ Completed' : 'Mark complete'}
    </button>
  );
}

export function PathProgress({
  pathId,
  articleIds,
  lessonCount,
}: {
  pathId: string;
  articleIds: string[];
  lessonCount: number;
}) {
  const { progress, setActivePath } = useProgress();
  useEffect(() => setActivePath(pathId), [pathId, setActivePath]);
  const count = articleIds.filter((id) => progress.completed.includes(id)).length;
  const percent = lessonCount ? Math.round((count / lessonCount) * 100) : 0;
  return (
    <div className="path-progress">
      <strong>
        {count} / {lessonCount} complete
      </strong>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>Pick up where you left off anytime.</small>
    </div>
  );
}

export function ArticlePathTracker({ pathId, articleId }: { pathId: string; articleId: string }) {
  const { recordVisit } = useProgress();
  useEffect(() => recordVisit(pathId, articleId), [pathId, articleId, recordVisit]);
  return null;
}

export type ContinuePath = {
  id: string;
  title: string;
  url: string;
  articles: Array<{ id: string; title: string; url: string }>;
};

export function ContinueLearning({ paths }: { paths: ContinuePath[] }) {
  const { progress } = useProgress();
  const active = paths.find((item) => item.id === progress.activePath);
  if (!active) {
    return (
      <section className="section continue-section" data-continue-learning>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your learning</span>
            <h2>Choose a learning path</h2>
            <p>Open a path to make it active and keep your place as you learn.</p>
          </div>
        </div>
        <div className="path-grid">
          {paths.map((path) => (
            <Link className="path-card" href={path.url} key={path.id}>
              <span className="eyebrow">Learning Path</span>
              <h3>{path.title}</h3>
              <span className="text-link">View path ↗</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }
  const completed = new Set(progress.completed);
  const visited = active.articles.find(
    (article) => article.id === progress.lastVisited[active.id] && !completed.has(article.id),
  );
  const next = visited || active.articles.find((article) => !completed.has(article.id));
  const count = active.articles.filter((article) => completed.has(article.id)).length;
  const percent = active.articles.length ? Math.round((count / active.articles.length) * 100) : 0;
  return (
    <section className="section continue-section" data-continue-learning>
      <div className="continue-card">
        <div>
          <span className="eyebrow">Your active path</span>
          <h2>{active.title}</h2>
          <p>
            {next?.title ?? 'You completed this path. Review a lesson or choose another route.'}
          </p>
          <div className="progress-track">
            <span style={{ width: `${percent}%` }} />
          </div>
          <small>
            {count} of {active.articles.length} lessons completed
          </small>
        </div>
        <Link className="button button-primary" href={next?.url ?? active.url}>
          {next ? 'Continue learning' : 'Review learning path'} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
