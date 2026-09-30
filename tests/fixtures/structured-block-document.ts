import type { ContentDocumentV1 } from '../../features/content-renderer/types';
import { readFileSync } from 'node:fs';

export const structuredBlockDocument = JSON.parse(
  readFileSync(new URL('./content/content-document-v1.json', import.meta.url), 'utf8'),
) as ContentDocumentV1;
