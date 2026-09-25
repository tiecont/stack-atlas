import { readFile } from 'node:fs/promises';
import path from 'node:path';

const expected = ['kubernetes', 'version-matrix.yaml'];
const source = path.resolve(process.cwd(), 'tests/kubernetes/version-matrix.yaml');

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (
    segments.length !== expected.length ||
    segments.some((segment, index) => segment !== expected[index])
  )
    return new Response('Not found', { status: 404 });
  try {
    return new Response(await readFile(source), {
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
