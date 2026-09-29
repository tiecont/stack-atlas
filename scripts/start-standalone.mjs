import { spawn } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const standaloneRoot = resolve(projectRoot, '.next/standalone');

await mkdir(resolve(standaloneRoot, '.next'), { recursive: true });
await cp(resolve(projectRoot, '.next/static'), resolve(standaloneRoot, '.next/static'), {
  recursive: true,
  force: true,
});
await cp(resolve(projectRoot, 'public'), resolve(standaloneRoot, 'public'), {
  recursive: true,
  force: true,
});

const server = spawn(process.execPath, ['server.js'], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    HOSTNAME: process.env.WEB_HOST ?? '127.0.0.1',
    PORT: process.env.PORT ?? '3001',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
