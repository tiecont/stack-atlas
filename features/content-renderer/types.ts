export type InlineContentNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineContentNode[] }
  | { type: 'italic'; children: InlineContentNode[] }
  | { type: 'inline_code'; children: InlineContentNode[] }
  | { type: 'link'; href: string; children: InlineContentNode[] };

export type RichTextNode =
  | { type: 'paragraph'; children: InlineContentNode[] }
  | { type: 'bullet_list'; items: InlineContentNode[][] }
  | { type: 'ordered_list'; items: InlineContentNode[][] };

export type RichTextContentBlock = { type: 'rich_text'; nodes: RichTextNode[] };
export type HeadingContentBlock = { type: 'heading'; level: 2 | 3 | 4; text: string; id?: string };
export type CodeContentBlock = { type: 'code'; language: string; code: string };
export type CalloutContentBlock = {
  type: 'callout';
  tone: 'info' | 'warning';
  text: string;
  title?: string;
};
export type ImageContentBlock = {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
};
export type TableContentBlock = {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
};
export type DividerContentBlock = { type: 'divider' };
export type RelatedContentItem = { title: string; href: string; description?: string };
export type RelatedContentBlock = { type: 'related_content'; items: RelatedContentItem[] };

export type ContentBlock =
  | RichTextContentBlock
  | HeadingContentBlock
  | CodeContentBlock
  | CalloutContentBlock
  | ImageContentBlock
  | TableContentBlock
  | DividerContentBlock
  | RelatedContentBlock;

/** UI renderer input only. This is not an API or persisted-content contract. */
export interface BlockDocument {
  blocks: readonly unknown[];
}

export type RendererMode = 'public' | 'preview';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isInlineNode(value: unknown, depth = 0): value is InlineContentNode {
  if (!isRecord(value) || depth > 16) return false;
  if (value['type'] === 'text') return isString(value['text']);
  if (!['bold', 'italic', 'inline_code', 'link'].includes(String(value['type']))) return false;
  if (
    !Array.isArray(value['children']) ||
    !value['children'].every((child) => isInlineNode(child, depth + 1))
  ) {
    return false;
  }
  return value['type'] !== 'link' || isString(value['href']);
}

function isRichTextNode(value: unknown): value is RichTextNode {
  if (!isRecord(value)) return false;
  if (value['type'] === 'paragraph') {
    return (
      Array.isArray(value['children']) && value['children'].every((child) => isInlineNode(child))
    );
  }
  if (value['type'] === 'bullet_list' || value['type'] === 'ordered_list') {
    return (
      Array.isArray(value['items']) &&
      value['items'].every(
        (item) => Array.isArray(item) && item.every((child) => isInlineNode(child)),
      )
    );
  }
  return false;
}

export function isContentBlock(value: unknown): value is ContentBlock {
  if (!isRecord(value) || typeof value['type'] !== 'string') return false;

  switch (value['type']) {
    case 'rich_text':
      return Array.isArray(value['nodes']) && value['nodes'].every(isRichTextNode);
    case 'heading':
      return (
        (value['level'] === 2 || value['level'] === 3 || value['level'] === 4) &&
        isString(value['text']) &&
        (value['id'] === undefined || isString(value['id']))
      );
    case 'code':
      return isString(value['language']) && isString(value['code']);
    case 'callout':
      return (
        (value['tone'] === 'info' || value['tone'] === 'warning') &&
        isString(value['text']) &&
        (value['title'] === undefined || isString(value['title']))
      );
    case 'image':
      return (
        isString(value['src']) &&
        isString(value['alt']) &&
        (value['caption'] === undefined || isString(value['caption']))
      );
    case 'table': {
      const headers = value['headers'];
      return (
        isStringArray(headers) &&
        Array.isArray(value['rows']) &&
        value['rows'].every((row) => isStringArray(row) && row.length === headers.length) &&
        (value['caption'] === undefined || isString(value['caption']))
      );
    }
    case 'divider':
      return true;
    case 'related_content':
      return (
        Array.isArray(value['items']) &&
        value['items'].every(
          (item) =>
            isRecord(item) &&
            isString(item['title']) &&
            isString(item['href']) &&
            (item['description'] === undefined || isString(item['description'])),
        )
      );
    default:
      return false;
  }
}
