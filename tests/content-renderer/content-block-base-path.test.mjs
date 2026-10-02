import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';

process.env.NEXT_PUBLIC_BASE_PATH = '/preview';
const { BlockRenderer } = await import('../../features/content-renderer/index.ts');

test('prefixes structured local links and images with the configured base path', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      document: {
        schema_version: 1,
        title: 'Base path',
        description: 'Local V1 URLs follow the Web deployment base path.',
        blocks: [
          {
            id: 'links',
            type: 'rich_text',
            version: 1,
            props: {
              nodes: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'link',
                      href: '/articles/golang/guide/',
                      children: [{ type: 'text', text: 'Internal article' }],
                    },
                    { type: 'text', text: ' and ' },
                    {
                      type: 'link',
                      href: 'https://example.com/guide',
                      children: [{ type: 'text', text: 'external guide' }],
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'diagram',
            type: 'image',
            version: 1,
            props: { src: '/images/diagram.svg', alt: 'Diagram' },
          },
        ],
      },
    }),
  );

  assert.match(html, /href="\/preview\/articles\/golang\/guide\/?"/);
  assert.match(html, /href="https:\/\/example\.com\/guide"/);
  assert.match(html, /src="\/preview\/images\/diagram\.svg"/);
});
