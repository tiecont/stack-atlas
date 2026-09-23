#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const values = new Map([
  ["stack-atlas-progress-v1", JSON.stringify({ completed: ["shared-article", "go-article"] })],
]);
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, value); },
};
const context = { window: { localStorage } };
vm.runInNewContext(fs.readFileSync(path.join(root, "src/scripts/progress-store.js"), "utf8"), context);

(async () => {
  const store = context.window.StackAtlasProgressStore;
  const migrated = await store.getProgress();
  assert.equal(migrated.version, 2);
  assert.deepEqual(Array.from(migrated.completed), ["shared-article", "go-article"]);
  assert.equal(migrated.activePath, null);
  assert.deepEqual(JSON.parse(values.get("stack-atlas-progress-v2")).completed, ["shared-article", "go-article"]);

  await store.recordVisit("kubernetes-engineer", "shared-article");
  await store.recordVisit("golang-backend", "go-article");
  await store.markComplete("k8s-only-article");
  const updated = await store.getProgress();
  assert.equal(updated.activePath, "golang-backend");
  assert.equal(updated.lastVisited["kubernetes-engineer"], "shared-article");
  assert.equal(updated.lastVisited["golang-backend"], "go-article");
  assert.deepEqual(Array.from(updated.completed), ["shared-article", "go-article", "k8s-only-article"]);
  await store.markIncomplete("shared-article");
  assert.deepEqual(Array.from((await store.getProgress()).completed), ["go-article", "k8s-only-article"]);
  process.stdout.write("Progress v1 migration and path-aware state passed.\n");
})().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
