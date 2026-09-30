import type { ReactNode } from 'react';
import { CalloutBlock } from './blocks/callout-block';
import { CodeBlock } from './blocks/code-block';
import { DividerBlock } from './blocks/divider-block';
import { HeadingBlock } from './blocks/heading-block';
import { ImageBlock } from './blocks/image-block';
import { RelatedContentBlock } from './blocks/related-content-block';
import { RichTextBlock } from './blocks/rich-text-block';
import { TableBlock } from './blocks/table-block';
import type { ContentBlock, RendererMode } from '../types';
import { isContentBlock, parseContentDocumentV1 } from '../types';

export const CONTENT_BLOCK_RENDERER_REGISTRY: Record<
  ContentBlock['type'],
  (block: ContentBlock) => ReactNode
> = {
  rich_text: (block) => (block.type === 'rich_text' ? <RichTextBlock block={block.props} /> : null),
  heading: (block) => (block.type === 'heading' ? <HeadingBlock block={block.props} /> : null),
  code: (block) => (block.type === 'code' ? <CodeBlock block={block.props} /> : null),
  callout: (block) => (block.type === 'callout' ? <CalloutBlock block={block.props} /> : null),
  image: (block) => (block.type === 'image' ? <ImageBlock block={block.props} /> : null),
  table: (block) => (block.type === 'table' ? <TableBlock block={block.props} /> : null),
  divider: () => <DividerBlock />,
  related_content: (block) =>
    block.type === 'related_content' ? <RelatedContentBlock block={block.props} /> : null,
};

export function BlockRenderer({
  document,
  mode = 'public',
}: {
  document: unknown;
  mode?: RendererMode;
}) {
  const parsedDocument = parseContentDocumentV1(document);
  if (!parsedDocument) {
    return (
      <div className="content-blocks">
        <aside className="content-unsupported" role="status">
          This content document is not available in this version.
        </aside>
      </div>
    );
  }
  return (
    <div className="content-blocks">
      {parsedDocument.blocks.map((block, index) => {
        if (!isContentBlock(block)) {
          const type =
            typeof block === 'object' &&
            block !== null &&
            'type' in block &&
            typeof block.type === 'string'
              ? block.type
              : 'unknown';
          return <UnsupportedBlock key={index} mode={mode} type={type} />;
        }
        return <Block key={block.id} block={block} />;
      })}
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  return <>{CONTENT_BLOCK_RENDERER_REGISTRY[block.type](block)}</>;
}

function UnsupportedBlock({ mode, type }: { mode: RendererMode; type: string }) {
  return mode === 'preview' ? (
    <aside className="content-unsupported" role="status">
      Unsupported content block: <code>{type}</code>
    </aside>
  ) : (
    <aside className="content-unsupported" role="status">
      This part of the content is not available in this version.
    </aside>
  );
}
