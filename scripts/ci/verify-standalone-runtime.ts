import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { exampleRuntimeFiles } from '../../lib/examples/registry.ts';
import { labRuntimeFiles } from '../../lib/labs/registry.ts';

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, '.next/standalone');

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

function assertExactFiles(rootName: 'labs' | 'examples', registeredFiles: string[]): void {
  const tree = path.join(STANDALONE, rootName);
  const actual = filesUnder(tree)
    .map((file) => path.relative(STANDALONE, file).split(path.sep).join('/'))
    .sort();
  const expected = registeredFiles.map((file) => file.replace(/^\.\//, '')).sort();
  const unexpected = actual.filter((file) => !expected.includes(file));
  const missing = expected.filter((file) => !actual.includes(file));
  if (unexpected.length || missing.length) {
    throw new Error(
      [
        `${rootName} standalone trace does not match its public registry.`,
        ...(unexpected.length ? [`Unregistered: ${unexpected.join(', ')}`] : []),
        ...(missing.length ? [`Missing: ${missing.join(', ')}`] : []),
      ].join('\n'),
    );
  }
}

if (!existsSync(STANDALONE)) {
  throw new Error('Next standalone output was not found; run this check after next build.');
}

if (existsSync(path.join(STANDALONE, 'tests'))) {
  throw new Error('The production standalone output contains the top-level tests directory.');
}

assertExactFiles('labs', labRuntimeFiles());
assertExactFiles('examples', exampleRuntimeFiles());

const pythonFiles = filesUnder(STANDALONE)
  .filter((file) => file.endsWith('.py'))
  .map((file) => path.relative(STANDALONE, file).split(path.sep).join('/'));
if (pythonFiles.length) {
  throw new Error(`Python tooling was traced into production: ${pythonFiles.join(', ')}`);
}

process.stdout.write(
  'Standalone runtime contains only registered lab/example files; tests and Python tooling are absent.\n',
);
