import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repositoryRoot = process.cwd();
const sourceRoots = ['app', 'components', 'features', 'lib'].map((path) =>
  resolve(repositoryRoot, path),
);
const e2eRoot = resolve(repositoryRoot, 'e2e');
const sharedTestRoot = resolve(repositoryRoot, 'tests');
const testFilePattern =
  /\.(?:(?:unit|integration|e2e)-)?(?:spec|test)\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/i;
const serviceSidecarPattern = /\.service\.spec\.ts$/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const sourceFiles = (await Promise.all(sourceRoots.map(walk))).flat();
const serviceFiles = sourceFiles.filter((path) => path.endsWith('.service.ts'));
const missingSidecars = serviceFiles.filter(
  (path) => !sourceFiles.includes(path.replace(/\.ts$/, '.spec.ts')),
);
const orphanSidecars = sourceFiles
  .filter((path) => serviceSidecarPattern.test(path))
  .filter((path) => !serviceFiles.includes(path.replace(/\.spec\.ts$/, '.ts')));
const misplacedSourceTests = sourceFiles.filter(
  (path) => testFilePattern.test(path) && !serviceSidecarPattern.test(path),
);
const e2eFiles = await walk(e2eRoot);
const rootE2eFiles = e2eFiles.filter((path) => relative(e2eRoot, path).split(/[\\/]/).length < 2);
const sharedTestFiles = (await walk(sharedTestRoot)).filter((path) => testFilePattern.test(path));
const rootSharedTestFiles = sharedTestFiles.filter(
  (path) => relative(sharedTestRoot, path).split(/[\\/]/).length < 2,
);

if (
  missingSidecars.length > 0 ||
  orphanSidecars.length > 0 ||
  misplacedSourceTests.length > 0 ||
  rootE2eFiles.length > 0 ||
  rootSharedTestFiles.length > 0
) {
  for (const path of missingSidecars) {
    console.error(`Missing service unit test sidecar: ${relative(repositoryRoot, path)}`);
  }
  for (const path of orphanSidecars) {
    console.error(`Remove orphan service unit test: ${relative(repositoryRoot, path)}`);
  }
  for (const path of misplacedSourceTests) {
    console.error(`Move tests to shared tests/: ${relative(repositoryRoot, path)}`);
  }
  for (const path of rootE2eFiles) {
    console.error(`Place e2e tests in a feature folder: ${relative(repositoryRoot, path)}`);
  }
  for (const path of rootSharedTestFiles) {
    console.error(`Place shared tests in a feature folder: ${relative(repositoryRoot, path)}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Test placement passed: ${serviceFiles.length} service sidecars; e2e tests are feature-scoped.`,
  );
}
