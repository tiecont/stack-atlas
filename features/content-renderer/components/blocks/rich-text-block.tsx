import type { ReactNode } from 'react';
import { SafeLink } from '../safe-link';
import type {
  InlineContentNode,
  RichTextContentBlock as RichTextContentBlockType,
  RichTextNode,
} from '../../types';

export function RichTextBlock({ block }: { block: RichTextContentBlockType }) {
  return (
    <div className="content-rich-text">
      {block.nodes.map((node, index) => renderRichTextNode(node, index))}
    </div>
  );
}

function renderInline(nodes: readonly InlineContentNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'text') return <span key={key}>{node.text}</span>;
    const children = renderInline(node.children, key);
    if (node.type === 'bold') return <strong key={key}>{children}</strong>;
    if (node.type === 'italic') return <em key={key}>{children}</em>;
    if (node.type === 'inline_code') return <code key={key}>{children}</code>;
    return (
      <SafeLink href={node.href} key={key}>
        {children}
      </SafeLink>
    );
  });
}

function renderRichTextNode(node: RichTextNode, index: number) {
  if (node.type === 'paragraph') {
    return <p key={index}>{renderInline(node.children, `paragraph-${index}`)}</p>;
  }

  const List = node.type === 'ordered_list' ? 'ol' : 'ul';
  return (
    <List key={index}>
      {node.items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
      ))}
    </List>
  );
}
