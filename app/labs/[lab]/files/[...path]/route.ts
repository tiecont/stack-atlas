import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLab } from '@/lib/labs/registry';

const contentTypes: Record<string, string> = {
  '.go': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lab: string; path: string[] }> },
) {
  const { lab: id, path: segments } = await params;
  const lab = getLab(id);
  const file = segments.join('/');
  if (!lab || !lab.publicFiles.includes(file)) return new Response('Not found', { status: 404 });

  const source = path.join(process.cwd(), 'labs', lab.directory, ...file.split('/'));
  try {
    const body = await readFile(source);
    const filename = path.basename(file).replace(/["\\\r\n]/g, '_');
    return new Response(body, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
