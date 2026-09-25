import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'examples');

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(target);
    const contentType = target.endsWith('.md') ? 'text/markdown; charset=utf-8' : target.endsWith('.yaml') || target.endsWith('.yml') ? 'application/yaml; charset=utf-8' : 'application/octet-stream';
    return new Response(body, { headers: { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
