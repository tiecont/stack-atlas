import type { BlockDocument } from '../../features/content-renderer/types';
import { readFileSync } from 'node:fs';

export const structuredBlockDocument = JSON.parse(
  readFileSync(new URL('./content-document.v1.json', import.meta.url), 'utf8'),
) as BlockDocument;
