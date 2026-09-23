(() => {
  window.StackAtlasPathContext = {
    resolve(searchIndex, requestedPath, articleId) {
      if (!requestedPath) return null;
      const path = (searchIndex.paths || []).find(item => item.id === requestedPath);
      if (!path) return null;
      const articles = new Map((searchIndex.articles || []).map(article => [article.id, article]));
      const sequence = [...(path.modules || [])]
        .sort((left, right) => left.order - right.order)
        .flatMap(module => (module.article_ids || [])
          .map(id => articles.has(id) ? {...articles.get(id), module_id: module.id} : null)
          .filter(Boolean));
      const position = sequence.findIndex(item => item.id === articleId);
      return position < 0 ? null : {path, sequence, position};
    }
  };
})();
