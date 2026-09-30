import { SafeLink } from '../safe-link';
import type { RelatedContentBlock as RelatedContentBlockType } from '../../types';

export function RelatedContentBlock({ block }: { block: RelatedContentBlockType }) {
  return (
    <aside className="content-related" aria-label="Related content">
      <h2>Related content</h2>
      <ul>
        {block.items.map((item, index) => (
          <li key={`${item.href}-${index}`}>
            <SafeLink href={item.href}>{item.title}</SafeLink>
            {item.description ? <p>{item.description}</p> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
