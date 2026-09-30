import type { CalloutContentBlock as CalloutContentBlockType } from '../../types';

export function CalloutBlock({ block }: { block: CalloutContentBlockType }) {
  return (
    <aside className={`content-callout content-callout-${block.tone}`}>
      {block.title ? <strong>{block.title}</strong> : null}
      <p>{block.text}</p>
    </aside>
  );
}
