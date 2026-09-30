import type { HeadingContentBlock as HeadingContentBlockType } from '../../types';

export function HeadingBlock({ block }: { block: HeadingContentBlockType }) {
  const id = block.id ? { id: block.id } : {};
  if (block.level === 2) return <h2 {...id}>{block.text}</h2>;
  if (block.level === 3) return <h3 {...id}>{block.text}</h3>;
  return <h4 {...id}>{block.text}</h4>;
}
