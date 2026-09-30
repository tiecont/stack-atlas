import type { CodeContentBlock as CodeContentBlockType } from '../../types';

export function CodeBlock({ block }: { block: CodeContentBlockType }) {
  return (
    <pre className="content-code">
      <code data-language={block.language}>{block.code}</code>
    </pre>
  );
}
