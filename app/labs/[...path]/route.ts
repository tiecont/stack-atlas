import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'labs');
const contentTypes: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8', '.yaml': 'application/yaml; charset=utf-8', '.yml': 'application/yaml; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8', '.go': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8',
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(target);
    return new Response(body, { headers: { 'Content-Type': contentTypes[path.extname(target)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
