export type LearningProgress = {
  version: 2;
  completed: string[];
  activePath: string | null;
  lastVisited: Record<string, string>;
};

export const EMPTY_PROGRESS: LearningProgress = {
  version: 2,
  completed: [],
  activePath: null,
  lastVisited: {},
};

export function normalizeProgress(value: unknown): LearningProgress {
  const record = isRecord(value) ? value : {};
  const lastVisited =
    record.lastVisited &&
    typeof record.lastVisited === 'object' &&
    !Array.isArray(record.lastVisited)
      ? Object.fromEntries(
          Object.entries(record.lastVisited).filter(
            (item): item is [string, string] => typeof item[1] === 'string',
          ),
        )
      : {};
  return {
    version: 2,
    completed: Array.isArray(record.completed)
      ? [...new Set(record.completed.filter((id): id is string => typeof id === 'string'))]
      : [],
    activePath: typeof record.activePath === 'string' ? record.activePath : null,
    lastVisited,
  };
}

export function readProgress(storage: Pick<Storage, 'getItem' | 'setItem'>): LearningProgress {
  try {
    const current = storage.getItem('stack-atlas-progress-v2');
    if (current) {
      const parsed: unknown = JSON.parse(current);
      if (isRecord(parsed) && parsed['version'] === 2) return normalizeProgress(parsed);
    }
    const legacy = storage.getItem('stack-atlas-progress-v1');
    const progress = normalizeProgress(legacy ? JSON.parse(legacy) : {});
    storage.setItem('stack-atlas-progress-v2', JSON.stringify(progress));
    return progress;
  } catch {
    return EMPTY_PROGRESS;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
