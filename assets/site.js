(() => {
  const BASE_PATH = "";
  const progressKey = 'stack-atlas-progress-v1';
  const memoryStore = { completed: [] };
  const LocalStorageProgressStore = {
    async getProgress() {
      try { return JSON.parse(localStorage.getItem(progressKey) || '{"completed":[]}'); }
      catch (_) { return memoryStore; }
    },
    async markComplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = [...new Set([...(progress.completed || []), articleId])];
      try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { Object.assign(memoryStore, progress); }
      return progress;
    },
    async markIncomplete(articleId) {
      const progress = await this.getProgress();
      progress.completed = (progress.completed || []).filter(id => id !== articleId);
      try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { Object.assign(memoryStore, progress); }
      return progress;
    }
  };

  const themeButton = document.querySelector('[data-theme-toggle]');
  const savedTheme = localStorage.getItem('stack-atlas-theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';
  const updateThemeButton = () => { if (themeButton) themeButton.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  updateThemeButton();
  themeButton?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    localStorage.setItem('stack-atlas-theme', dark ? 'dark' : 'light'); updateThemeButton();
  });

  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('is-open', open);
  });

  const dialog = document.querySelector('#search-dialog');
  const searchInput = document.querySelector('#site-search');
  document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => {
    if (dialog && !dialog.open) { dialog.showModal(); setTimeout(() => searchInput?.focus(), 30); }
  }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); dialog?.showModal(); searchInput?.focus(); }
    if (event.key === 'Escape' && dialog?.open) dialog.close();
  });
  let searchIndex = null;
  let searchFilter = 'all';
  const results = document.querySelector('#search-results');
  const renderResults = () => {
    if (!results || !searchInput) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    if (!query) { results.innerHTML = '<p class="empty-state">Type to search articles, topics and learning paths.</p>'; return; }
    if (!searchIndex) { results.innerHTML = '<p class="empty-state">Loading the library…</p>'; return; }
    const all = [
      ...(searchIndex.articles || []).map(item => ({...item, kind: 'article', label: 'Article'})),
      ...(searchIndex.domains || []).map(item => ({...item, kind: 'topic', url: `/topics/${item.id}/`, label: 'Topic'})),
      ...(searchIndex.paths || []).map(item => ({...item, kind: 'path', url: `/paths/${item.id}/`, label: 'Learning Path'}))
    ];
    const matches = all.filter(item => (searchFilter === 'all' || searchFilter === item.kind) && `${item.title} ${item.description || ''} ${item.domain || ''} ${(item.tags || []).join(' ')}`.toLocaleLowerCase().includes(query)).slice(0, 20);
    if (!matches.length) { results.innerHTML = '<p class="empty-state">No matches. Try another term.</p>'; return; }
    results.innerHTML = matches.map(item => `<a class="search-result" href="${BASE_PATH}${item.url}"><span class="result-kind">${item.label}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || item.domain || '')}</small></a>`).join('');
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  searchInput?.addEventListener('input', renderResults);
  document.querySelectorAll('[data-search-filter]').forEach(button => button.addEventListener('click', () => {
    searchFilter = button.dataset.searchFilter;
    document.querySelectorAll('[data-search-filter]').forEach(item => item.classList.toggle('is-active', item === button)); renderResults();
  }));
  const syncPathNavigation = () => {
    const navigation = document.querySelector('[data-path-navigation]');
    const articlePage = document.querySelector('.article-page[data-article-id]');
    if (!navigation || !articlePage || !searchIndex) return;
    const requestedPath = new URLSearchParams(location.search).get('path') || navigation.dataset.pathNavigation;
    const path = (searchIndex.paths || []).find(item => item.id === requestedPath);
    if (!path) return;
    const articleId = articlePage.dataset.articleId;
    const sequence = (searchIndex.articles || []).flatMap(item => (item.learning_paths || []).filter(member => member === requestedPath || (typeof member === 'object' && member.path_id === requestedPath)).map(member => {
      const moduleId = typeof member === 'object' ? member.module_id : path.modules.find(module => module.article_ids.includes(item.id))?.id;
      return {...item, order: typeof member === 'object' ? member.order : item.path_order, module_id: moduleId};
    })).sort((a, b) => a.order - b.order);
    const position = sequence.findIndex(item => item.id === articleId);
    if (position < 0) return;
    const makeLink = (item, label, side) => {
      if (!item) return document.createElement('span');
      const anchor = document.createElement('a');
      anchor.href = `${BASE_PATH}${item.url}?path=${encodeURIComponent(requestedPath)}`;
      if (side === 'next') anchor.style.textAlign = 'right';
      const small = document.createElement('small'); small.textContent = label;
      const strong = document.createElement('strong'); strong.textContent = item.title;
      anchor.append(small, strong);
      return anchor;
    };
    navigation.replaceChildren(makeLink(sequence[position - 1], 'Previous', 'previous'), makeLink(sequence[position + 1], 'Next', 'next'));
    navigation.dataset.pathNavigation = requestedPath;
    const context = document.querySelector('[data-path-context]');
    if (context) {
      const currentModule = path.modules.find(module => module.id === sequence[position].module_id);
      const modulePosition = currentModule?.article_ids.indexOf(articleId) ?? -1;
      context.href = `${BASE_PATH}${path.url}`;
      context.querySelector('span').textContent = `Part of ${path.title}`;
      context.querySelector('strong').textContent = currentModule ? `${currentModule.title} · Lesson ${String(modulePosition + 1).padStart(2, '0')}` : path.title;
    }
  };
  if (dialog) fetch(`${BASE_PATH}/search-index.json`).then(response => response.json()).then(index => { searchIndex = index; renderResults(); syncPathNavigation(); }).catch(() => { if (results) results.innerHTML = '<p class="empty-state">Search is temporarily unavailable.</p>'; });

  const paintProgress = async () => {
    const progress = await LocalStorageProgressStore.getProgress();
    const completed = new Set(progress.completed || []);
    document.querySelectorAll('[data-progress-toggle]').forEach(button => {
      const done = completed.has(button.dataset.progressToggle);
      button.setAttribute('aria-pressed', String(done)); button.textContent = done ? '✓ Completed' : 'Mark complete';
    });
    document.querySelectorAll('[data-progress-path]').forEach(container => {
      const ids = [...container.querySelectorAll('[data-article-id]')].map(item => item.dataset.articleId);
      const count = ids.filter(id => completed.has(id)).length;
      const percent = ids.length ? Math.round(count / ids.length * 100) : 0;
      container.querySelectorAll('[data-progress-bar]').forEach(bar => bar.style.width = `${percent}%`);
      container.querySelectorAll('[data-progress-label]').forEach(label => label.textContent = container.classList.contains('path-page') ? `${count} / ${ids.length} complete` : `${count} of ${ids.length} lessons completed`);
      const continueLink = container.querySelector('[data-continue-link]');
      const continueCopy = container.querySelector('[data-continue-copy]');
      if (continueLink && ids.length) {
        const firstIncomplete = [...container.querySelectorAll('[data-article-id]')].find(item => !completed.has(item.dataset.articleId));
        const nextLink = firstIncomplete?.querySelector('.path-article-link');
        if (firstIncomplete) { continueLink.href = nextLink?.href || `${BASE_PATH}${firstIncomplete.dataset.articleUrl}`; continueLink.innerHTML = 'Continue learning <span aria-hidden="true">→</span>'; continueCopy.textContent = firstIncomplete.querySelector('strong')?.textContent || firstIncomplete.dataset.articleTitle || 'Resume your learning path.'; }
        else { continueLink.href = `${BASE_PATH}/paths/`; continueLink.innerHTML = 'Explore learning paths <span aria-hidden="true">→</span>'; continueCopy.textContent = 'You completed this path. Choose another route through the Atlas.'; }
      }
    });
  };
  document.querySelectorAll('[data-progress-toggle]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.progressToggle;
    if (button.getAttribute('aria-pressed') === 'true') await LocalStorageProgressStore.markIncomplete(id); else await LocalStorageProgressStore.markComplete(id);
    paintProgress();
  }));
  paintProgress();
})();
