import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];
const platformDir = path.join(root, 'platform');
const pythonPath = [platformDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
const python = process.env.PYTHON || 'python3';

const build = spawnSync(python, ['-m', 'stack_atlas.cli.build'], {
  cwd: root,
  env: { ...process.env, PYTHONPATH: pythonPath },
  stdio: 'inherit',
});

if (build.error) throw build.error;
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const publicAssets = path.join(publicDir, 'assets');
const generatedSite = path.join(publicDir, 'generated-site');
rmSync(publicAssets, { recursive: true, force: true });
rmSync(generatedSite, { recursive: true, force: true });
mkdirSync(publicAssets, { recursive: true });
cpSync(path.join(distDir, 'assets'), publicAssets, { recursive: true });
cpSync(distDir, generatedSite, { recursive: true });

for (const name of ['search-index.json', 'robots.txt', 'sitemap.xml']) {
  cpSync(path.join(distDir, name), path.join(publicDir, name));
}

const scriptsDir = path.join(platformDir, 'assets', 'scripts');
const progressStore = readFileSync(path.join(scriptsDir, 'progress-store.js'), 'utf8');
const pathContext = readFileSync(path.join(scriptsDir, 'path-context.js'), 'utf8');
const apiClient = readFileSync(path.join(scriptsDir, 'api-client.js'), 'utf8');
const site = readFileSync(path.join(scriptsDir, 'site.js'), 'utf8').replace(
  'const BASE_PATH = __BASE_PATH__;',
  'const BASE_PATH = "";',
);
writeFileSync(
  path.join(publicAssets, 'legacy-runtime.js'),
  [progressStore, pathContext, apiClient, site].join('\n;\n'),
  'utf8',
);

if (!command) process.exit(0);
if (!['dev', 'build'].includes(command)) {
  throw new Error(`Unknown Next.js command: ${command}`);
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const args = command === 'dev'
  ? ['dev', '--hostname', '127.0.0.1', '--port', '3001']
  : ['build'];
const next = spawnSync(process.execPath, [nextBin, ...args], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

if (next.error) throw next.error;
process.exit(next.status ?? 1);
