// GENERATED FILE — edit src/scripts/site.js
(() => {
  const BASE_PATH = "";
  const LocalStorageProgressStore = window.StackAtlasProgressStore;

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
  const syncPathNavigation = async () => {
    const navigation = document.querySelector('[data-path-navigation]');
    const articlePage = document.querySelector('.article-page[data-article-id]');
    if (!navigation || !articlePage || !searchIndex) return;
    const requestedPathParam = new URLSearchParams(location.search).get('path');
    const requestedPath = requestedPathParam || navigation.dataset.pathNavigation;
    const path = (searchIndex.paths || []).find(item => item.id === requestedPath);
    if (!path) return;
    const articleId = articlePage.dataset.articleId;
    const articlesById = new Map((searchIndex.articles || []).map(item => [item.id, item]));
    const sequence = [...path.modules].sort((a, b) => a.order - b.order).flatMap(module =>
      (module.article_ids || []).map(id => ({...articlesById.get(id), module_id: module.id})).filter(item => item.id)
    );
    const position = sequence.findIndex(item => item.id === articleId);
    if (position < 0) return;
    if (requestedPathParam) await LocalStorageProgressStore.recordVisit(requestedPath, articleId);
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
  if (dialog) fetch(`${BASE_PATH}/search-index.json`).then(response => response.json()).then(async index => { searchIndex = index; renderResults(); await syncPathNavigation(); await paintProgress(); }).catch(() => { if (results) results.innerHTML = '<p class="empty-state">Search is temporarily unavailable.</p>'; });

  const paintContinueLearning = progress => {
    const section = document.querySelector('[data-continue-learning]');
    if (!section) return;
    const panel = section.querySelector('[data-active-path-panel]');
    const choices = section.querySelector('[data-path-choices]');
    const path = (searchIndex?.paths || []).find(item => item.id === progress.activePath);
    if (!panel || !choices || !path) {
      if (panel) panel.hidden = true;
      if (choices) choices.hidden = false;
      return;
    }

    panel.hidden = false;
    choices.hidden = true;
    const articleById = new Map((searchIndex?.articles || []).map(article => [article.id, article]));
    const sequence = [...path.modules].sort((a, b) => a.order - b.order).flatMap(module => (module.article_ids || []).map(id => articleById.get(id)).filter(Boolean));
    const completed = new Set(progress.completed || []);
    const lastVisited = sequence.find(article => article.id === progress.lastVisited?.[path.id] && !completed.has(article.id));
    const resumeArticle = lastVisited || sequence.find(article => !completed.has(article.id));
    const count = sequence.filter(article => completed.has(article.id)).length;
    const percent = sequence.length ? Math.round(count / sequence.length * 100) : 0;
    section.querySelector('[data-active-path-title]').textContent = path.title;
    section.querySelector('[data-progress-bar]').style.width = `${percent}%`;
    section.querySelector('[data-progress-label]').textContent = `${count} of ${sequence.length} lessons completed`;
    const link = section.querySelector('[data-continue-link]');
    const copy = section.querySelector('[data-continue-copy]');
    if (resumeArticle) {
      link.href = `${BASE_PATH}${resumeArticle.url}?path=${encodeURIComponent(path.id)}`;
      link.innerHTML = 'Continue learning <span aria-hidden="true">→</span>';
      copy.textContent = resumeArticle.title;
    } else {
      link.href = `${BASE_PATH}${path.url}`;
      link.innerHTML = 'Review learning path <span aria-hidden="true">→</span>';
      copy.textContent = 'You completed this path. Review a lesson or choose another route through the Atlas.';
    }
  };

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
    paintContinueLearning(progress);
  };
  document.querySelectorAll('[data-progress-toggle]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.progressToggle;
    if (button.getAttribute('aria-pressed') === 'true') await LocalStorageProgressStore.markIncomplete(id); else await LocalStorageProgressStore.markComplete(id);
    paintProgress();
  }));
  const currentPathPage = document.querySelector('.path-page[data-progress-path]');
  if (currentPathPage) {
    LocalStorageProgressStore.setActivePath(currentPathPage.dataset.progressPath).then(paintProgress);
  }
  paintProgress();
})();
