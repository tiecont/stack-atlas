// GENERATED FILE — edit src/scripts/progress-store.js
(() => {
  const legacyKey = 'stack-atlas-progress-v1';
  const currentKey = 'stack-atlas-progress-v2';
  const memoryStore = { version: 2, completed: [], activePath: null, lastVisited: {} };
  const normalize = value => ({
    version: 2,
    completed: Array.isArray(value?.completed) ? [...new Set(value.completed.filter(id => typeof id === 'string'))] : [],
    activePath: typeof value?.activePath === 'string' ? value.activePath : null,
    lastVisited: value?.lastVisited && typeof value.lastVisited === 'object' && !Array.isArray(value.lastVisited) ? value.lastVisited : {}
  });

  const store = {
    async getProgress() {
      try {
        const current = window.localStorage.getItem(currentKey);
        if (current) {
          const parsed = JSON.parse(current);
          if (parsed?.version === 2) return normalize(parsed);
        }
        const legacy = window.localStorage.getItem(legacyKey);
        const migrated = normalize(legacy ? JSON.parse(legacy) : {});
        await this.save(migrated);
        return migrated;
      } catch (_) {
        return normalize(memoryStore);
      }
    },
    async save(progress) {
      const normalized = normalize(progress);
      Object.assign(memoryStore, normalized);
      try { window.localStorage.setItem(currentKey, JSON.stringify(normalized)); }
      catch (_) { /* Keep progress in memory when storage is unavailable. */ }
      return normalized;
    },
    async markComplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = [...new Set([...progress.completed, articleId])];
      return this.save(progress);
    },
    async markIncomplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = progress.completed.filter(id => id !== articleId);
      return this.save(progress);
    },
    async setActivePath(pathId) {
      const progress = await this.getProgress();
      progress.activePath = pathId;
      return this.save(progress);
    },
    async recordVisit(pathId, articleId) {
      const progress = await this.getProgress();
      progress.activePath = pathId;
      progress.lastVisited[pathId] = articleId;
      return this.save(progress);
    }
  };

  window.StackAtlasProgressStore = store;
})();
