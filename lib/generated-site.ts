import { readFile } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'public', 'generated-site');

export type GeneratedPage = {
  html: string;
  body: string;
  title: string;
  description: string;
  redirectTo?: string;
};

export async function readGeneratedPage(segments: string[] = []): Promise<GeneratedPage | null> {
  const target = path.resolve(distRoot, ...segments, 'index.html');
  if (!target.startsWith(`${distRoot}${path.sep}`) && target !== path.join(distRoot, 'index.html')) {
    return null;
  }

  let html: string;
  try {
    html = await readFile(target, 'utf8');
  } catch {
    return null;
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (body === undefined) return null;

  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'Stack Atlas';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ||
    'Engineering knowledge, from code to infrastructure.';
  const refresh = html.match(/<meta\s+http-equiv="refresh"\s+content="0;url=([^"]+)"/i)?.[1];

  return { html, body, title, description, redirectTo: refresh };
}
