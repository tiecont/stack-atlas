import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  ['format:check', ['run', 'format:check']],
  ['content:validate', ['run', 'content:validate']],
  ['typecheck', ['run', 'typecheck']],
  ['lint', ['run', 'lint']],
  ['unit tests', ['test']],
];

for (const [label, args] of checks) {
  process.stdout.write(`\n[local-ci] ${label}\n`);
  const result = spawnSync(npm, args, { cwd: root, stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`[local-ci] Could not start npm: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`[local-ci] ${label} failed with exit code ${result.status ?? 1}\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('\n[local-ci] Local checks passed.\n');
