import type { BlockDocument } from '../../features/content-renderer/types';

export const structuredBlockDocument: BlockDocument = {
  blocks: [
    {
      type: 'rich_text',
      nodes: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Structured ' },
            { type: 'bold', children: [{ type: 'text', text: 'content' }] },
            { type: 'text', text: ' with ' },
            { type: 'italic', children: [{ type: 'text', text: 'formatting' }] },
            { type: 'text', text: ', ' },
            { type: 'inline_code', children: [{ type: 'text', text: 'safe()' }] },
            { type: 'text', text: ', and ' },
            {
              type: 'link',
              href: 'https://example.com/guide',
              children: [{ type: 'text', text: 'a safe external link' }],
            },
            { type: 'text', text: '.' },
          ],
        },
        { type: 'bullet_list', items: [[{ type: 'text', text: 'First item' }]] },
        { type: 'ordered_list', items: [[{ type: 'text', text: 'Second item' }]] },
      ],
    },
    { type: 'heading', level: 2, id: 'overview', text: 'Overview' },
    { type: 'code', language: 'go', code: 'fmt.Println("safe")' },
    { type: 'callout', tone: 'warning', title: 'Check', text: 'Validate inputs.' },
    {
      type: 'image',
      src: '/images/architecture.svg',
      alt: 'A system diagram',
      caption: 'System view',
    },
    { type: 'table', headers: ['Layer', 'Owner'], rows: [['Web', 'Stack Atlas']] },
    { type: 'divider' },
    {
      type: 'related_content',
      items: [{ title: 'Architecture guide', href: '/articles/architecture/guide/' }],
    },
  ],
};
