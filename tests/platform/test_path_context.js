const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'platform/assets/scripts/path-context.js'), 'utf8'), {window});
const resolve = window.StackAtlasPathContext.resolve;
const index = {
  articles: ['intro', 'shared', 'other'].map(id => ({id, title: id, url: `/articles/demo/${id}/`})),
  paths: [
    {id: 'golang-backend', title: 'Go', modules: [{id: 'go', order: 2, article_ids: ['other']}]},
    {id: 'kubernetes-engineer', title: 'Kubernetes', modules: [
      {id: 'later', order: 2, article_ids: ['shared']},
      {id: 'first', order: 1, article_ids: ['intro', 'shared']}
    ]}
  ]
};

assert.equal(resolve(index, 'missing-path', 'shared'), null);
assert.equal(resolve(index, 'golang-backend', 'shared'), null);
const selected = resolve(index, 'kubernetes-engineer', 'shared');
assert.equal(selected.path.id, 'kubernetes-engineer');
assert.equal(selected.sequence[selected.position].module_id, 'first');
assert.equal(selected.sequence[selected.position - 1].id, 'intro');
console.log('Path-context selection regressions passed.');
