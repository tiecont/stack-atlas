import type { ReactNode } from 'react';
import { CalloutBlock } from './blocks/callout-block';
import { CodeBlock } from './blocks/code-block';
import { DividerBlock } from './blocks/divider-block';
import { HeadingBlock } from './blocks/heading-block';
import { ImageBlock } from './blocks/image-block';
import { RelatedContentBlock } from './blocks/related-content-block';
import { RichTextBlock } from './blocks/rich-text-block';
import { TableBlock } from './blocks/table-block';
import type { BlockDocument, ContentBlock, RendererMode } from '../types';
import { isContentBlock } from '../types';

const BLOCK_REGISTRY: Record<ContentBlock['type'], (block: ContentBlock) => ReactNode> = {
  rich_text: (block) => (block.type === 'rich_text' ? <RichTextBlock block={block} /> : null),
  heading: (block) => (block.type === 'heading' ? <HeadingBlock block={block} /> : null),
  code: (block) => (block.type === 'code' ? <CodeBlock block={block} /> : null),
  callout: (block) => (block.type === 'callout' ? <CalloutBlock block={block} /> : null),
  image: (block) => (block.type === 'image' ? <ImageBlock block={block} /> : null),
  table: (block) => (block.type === 'table' ? <TableBlock block={block} /> : null),
  divider: () => <DividerBlock />,
  related_content: (block) =>
    block.type === 'related_content' ? <RelatedContentBlock block={block} /> : null,
};

export function BlockRenderer({
  document,
  mode = 'public',
}: {
  document: BlockDocument;
  mode?: RendererMode;
}) {
  return (
    <div className="content-blocks">
      {document.blocks.map((block, index) => {
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
        return <Block key={index} block={block} />;
      })}
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  return <>{BLOCK_REGISTRY[block.type](block)}</>;
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
