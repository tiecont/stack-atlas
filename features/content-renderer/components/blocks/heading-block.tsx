import type { HeadingContentBlock as HeadingContentBlockType } from '../../types';

export function HeadingBlock({ block }: { block: HeadingContentBlockType }) {
  const anchor = block.anchor ? { id: block.anchor } : {};
  if (block.level === 2) return <h2 {...anchor}>{block.text}</h2>;
  if (block.level === 3) return <h3 {...anchor}>{block.text}</h3>;
  return <h4 {...anchor}>{block.text}</h4>;
}
