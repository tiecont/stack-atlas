import {
  CONTENT_DOCUMENT_LIMITS_V1,
  isContentBlock,
  isContentDocumentV1,
  type ContentBlock,
  type ContentBlockTypeV1,
  type ContentDocumentV1,
  type InlineContentNode,
} from '@/features/content-renderer/types';

export interface EditorValidationIssue {
  target: string;
  message: string;
}

export function createDefaultBlock(type: ContentBlockTypeV1, id: string): ContentBlock {
  switch (type) {
    case 'rich_text':
      return {
        id,
        type,
        version: 1,
        props: { nodes: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
      };
    case 'heading':
      return { id, type, version: 1, props: { level: 2, text: 'New heading' } };
    case 'code':
      return { id, type, version: 1, props: { language: 'text', code: '' } };
    case 'callout':
      return { id, type, version: 1, props: { tone: 'info', text: 'Add callout content.' } };
    case 'image':
      return {
        id,
        type,
        version: 1,
        props: { src: '/images/diagram.png', alt: '' },
      };
    case 'table':
      return {
        id,
        type,
        version: 1,
        props: { headers: ['Column 1'], rows: [['']] },
      };
    case 'divider':
      return { id, type, version: 1, props: {} };
    case 'related_content':
      return {
        id,
        type,
        version: 1,
        props: { items: [{ title: 'Related content', href: '/articles/' }] },
      };
  }
}

export function insertBlock(blocks: readonly ContentBlock[], block: ContentBlock): ContentBlock[] {
  return [...blocks, block];
}

export function removeBlock(blocks: readonly ContentBlock[], blockId: string): ContentBlock[] {
  return blocks.filter((block) => block.id !== blockId);
}

export function moveBlock(
  blocks: readonly ContentBlock[],
  blockId: string,
  offset: -1 | 1,
): ContentBlock[] {
  const from = blocks.findIndex((block) => block.id === blockId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= blocks.length) return [...blocks];
  const reordered = [...blocks];
  const [block] = reordered.splice(from, 1);
  if (!block) return [...blocks];
  reordered.splice(to, 0, block);
  return reordered;
}

export function duplicateBlock(
  blocks: readonly ContentBlock[],
  blockId: string,
  newId: string,
): ContentBlock[] {
  const index = blocks.findIndex((block) => block.id === blockId);
  const block = blocks[index];
  if (!block || !newId.trim() || blocks.some((candidate) => candidate.id === newId)) {
    return [...blocks];
  }
  const copy: ContentBlock = { ...block, id: newId };
  return [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)];
}

export function makeInlineNode(
  type: InlineContentNode['type'],
  existing?: InlineContentNode,
): InlineContentNode {
  const text =
    existing?.type === 'text'
      ? existing.text
      : existing && 'children' in existing
        ? existing.children.map(inlineText).join('')
        : '';
  const children =
    existing && 'children' in existing
      ? existing.children
      : ([{ type: 'text', text }] satisfies InlineContentNode[]);

  if (type === 'text') return { type, text };
  if (type === 'link') {
    return {
      type,
      href: existing?.type === 'link' ? existing.href : '',
      children,
    };
  }
  return { type, children };
}

function inlineText(node: InlineContentNode): string {
  return node.type === 'text' ? node.text : node.children.map(inlineText).join('');
}

export function validateEditorDocument(document: ContentDocumentV1): EditorValidationIssue[] {
  const issues: EditorValidationIssue[] = [];

  if (!document.title.trim() || document.title.length > 160) {
    issues.push({ target: 'document-title', message: 'Enter a title up to 160 characters.' });
  }
  if (!document.description.trim() || document.description.length > 500) {
    issues.push({
      target: 'document-description',
      message: 'Enter a description up to 500 characters.',
    });
  }
  if (document.blocks.length > CONTENT_DOCUMENT_LIMITS_V1.maxBlocks) {
    issues.push({ target: 'block-adder', message: 'A document can contain at most 500 blocks.' });
  }

  const seenIds = new Set<string>();
  document.blocks.forEach((block, index) => {
    const id =
      typeof block === 'object' && block !== null && 'id' in block && typeof block.id === 'string'
        ? block.id
        : `item-${index + 1}`;
    const target = `editor-block-${id}`;
    if (seenIds.has(id)) {
      issues.push({ target, message: `Block ID '${id}' is used more than once.` });
    }
    seenIds.add(id);
    if (!isContentBlock(block)) {
      issues.push({
        target,
        message: 'This block has invalid fields, an unsafe URL, or a value outside the V1 limits.',
      });
    }
  });

  if (!isContentDocumentV1(document) && issues.length === 0) {
    issues.push({
      target: 'document-validation',
      message: 'The document does not match Content Document V1 limits.',
    });
  }
  return issues;
}
