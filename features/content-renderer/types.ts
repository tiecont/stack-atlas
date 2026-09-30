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

export type RichTextContentBlock = { nodes: RichTextNode[] };
export type HeadingContentBlock = {
  level: 2 | 3 | 4;
  text: string;
  id?: string;
};
export type CodeContentBlock = { language: string; code: string };
export type CalloutContentBlock = {
  tone: 'info' | 'warning';
  text: string;
  title?: string;
};
export type ImageContentBlock = {
  src: string;
  alt: string;
  caption?: string;
};
export type TableContentBlock = {
  headers: string[];
  rows: string[][];
  caption?: string;
};
export type DividerContentBlock = Record<string, never>;
export type RelatedContentItem = {
  title: string;
  href: string;
  description?: string;
};
export type RelatedContentBlock = { items: RelatedContentItem[] };

export type ContentBlockEnvelope<TType extends string, TProps> = {
  id: string;
  type: TType;
  version: 1;
  props: TProps;
};

export type ContentBlock =
  | ContentBlockEnvelope<'rich_text', RichTextContentBlock>
  | ContentBlockEnvelope<'heading', HeadingContentBlock>
  | ContentBlockEnvelope<'code', CodeContentBlock>
  | ContentBlockEnvelope<'callout', CalloutContentBlock>
  | ContentBlockEnvelope<'image', ImageContentBlock>
  | ContentBlockEnvelope<'table', TableContentBlock>
  | ContentBlockEnvelope<'divider', DividerContentBlock>
  | ContentBlockEnvelope<'related_content', RelatedContentBlock>;

/** The persisted V1 document shape; block values stay unknown for safe fallback rendering. */
export interface BlockDocument {
  schema_version: 1;
  title: string;
  description: string;
  blocks: readonly unknown[];
}

export type RendererMode = 'public' | 'preview';

const BLOCK_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const HEADING_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isContentDocumentV1(value: unknown): value is BlockDocument {
  if (
    isRecord(value) &&
    hasKeys(value, ['schema_version', 'title', 'description', 'blocks']) &&
    value['schema_version'] === 1 &&
    isBoundedText(value['title'], 160) &&
    isBoundedText(value['description'], 500) &&
    Array.isArray(value['blocks']) &&
    value['blocks'].length <= 500
  ) {
    const blockIds = new Set<string>();
    return value['blocks'].every((block) => {
      if (
        !isRecord(block) ||
        !isBoundedText(block['id'], 128) ||
        !BLOCK_ID_PATTERN.test(block['id']) ||
        blockIds.has(block['id'])
      ) {
        return false;
      }
      blockIds.add(block['id']);
      return true;
    });
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function isBoundedText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' && value.length <= maximum && (allowEmpty || value.trim().length > 0)
  );
}

function hasKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function isInlineNode(value: unknown, depth = 0): value is InlineContentNode {
  if (!isRecord(value) || depth > 16) return false;
  if (value['type'] === 'text') {
    return hasKeys(value, ['type', 'text']) && isBoundedText(value['text'], 10_000, true);
  }
  if (value['type'] === 'link') {
    return (
      hasKeys(value, ['type', 'href', 'children']) &&
      isBoundedText(value['href'], 2048) &&
      isInlineNodes(value['children'], depth + 1)
    );
  }
  if (!['bold', 'italic', 'inline_code'].includes(String(value['type']))) {
    return false;
  }
  return hasKeys(value, ['type', 'children']) && isInlineNodes(value['children'], depth + 1);
}

function isInlineNodes(value: unknown, depth: number): value is InlineContentNode[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 500 &&
    value.every((child) => isInlineNode(child, depth))
  );
}

function isRichTextNode(value: unknown): value is RichTextNode {
  if (!isRecord(value)) return false;
  if (value['type'] === 'paragraph') {
    return hasKeys(value, ['type', 'children']) && isInlineNodes(value['children'], 0);
  }
  if (value['type'] === 'bullet_list' || value['type'] === 'ordered_list') {
    return (
      hasKeys(value, ['type', 'items']) &&
      Array.isArray(value['items']) &&
      value['items'].length > 0 &&
      value['items'].length <= 100 &&
      value['items'].every((item) => isInlineNodes(item, 0))
    );
  }
  return false;
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maxItems &&
    value.every((item) => isBoundedText(item, maxLength))
  );
}

export function isContentBlock(value: unknown): value is ContentBlock {
  if (
    !isRecord(value) ||
    !hasKeys(value, ['id', 'type', 'version', 'props']) ||
    !isBoundedText(value['id'], 128) ||
    !BLOCK_ID_PATTERN.test(value['id']) ||
    value['version'] !== 1 ||
    !isRecord(value['props'])
  ) {
    return false;
  }

  const props = value['props'];
  switch (value['type']) {
    case 'rich_text':
      return (
        hasKeys(props, ['nodes']) &&
        Array.isArray(props['nodes']) &&
        props['nodes'].length > 0 &&
        props['nodes'].length <= 500 &&
        props['nodes'].every(isRichTextNode)
      );
    case 'heading':
      return (
        hasKeys(props, ['level', 'text'], ['id']) &&
        (props['level'] === 2 || props['level'] === 3 || props['level'] === 4) &&
        isBoundedText(props['text'], 160) &&
        (props['id'] === undefined ||
          (isBoundedText(props['id'], 120) && HEADING_ID_PATTERN.test(props['id'])))
      );
    case 'code':
      return (
        hasKeys(props, ['language', 'code']) &&
        isBoundedText(props['language'], 40) &&
        isBoundedText(props['code'], 100_000, true)
      );
    case 'callout':
      return (
        hasKeys(props, ['tone', 'text'], ['title']) &&
        (props['tone'] === 'info' || props['tone'] === 'warning') &&
        isBoundedText(props['text'], 10_000) &&
        (props['title'] === undefined || isBoundedText(props['title'], 160))
      );
    case 'image':
      return (
        hasKeys(props, ['src', 'alt'], ['caption']) &&
        isBoundedText(props['src'], 2048) &&
        isBoundedText(props['alt'], 1000, true) &&
        (props['caption'] === undefined || isBoundedText(props['caption'], 500))
      );
    case 'table': {
      const headers = props['headers'];
      const rows = props['rows'];
      return (
        hasKeys(props, ['headers', 'rows'], ['caption']) &&
        isStringArray(headers, 20, 500) &&
        Array.isArray(rows) &&
        rows.length > 0 &&
        rows.length <= 100 &&
        rows.every(
          (row) =>
            Array.isArray(row) &&
            row.length === headers.length &&
            row.every((cell) => isBoundedText(cell, 2000, true)),
        ) &&
        (props['caption'] === undefined || isBoundedText(props['caption'], 500))
      );
    }
    case 'divider':
      return hasKeys(props, []);
    case 'related_content':
      return (
        hasKeys(props, ['items']) &&
        Array.isArray(props['items']) &&
        props['items'].length > 0 &&
        props['items'].length <= 20 &&
        props['items'].every(
          (item) =>
            isRecord(item) &&
            hasKeys(item, ['title', 'href'], ['description']) &&
            isBoundedText(item['title'], 160) &&
            isBoundedText(item['href'], 2048) &&
            (item['description'] === undefined || isBoundedText(item['description'], 500)),
        )
      );
    default:
      return false;
  }
}
