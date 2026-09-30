import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { BlockRenderer } from '../../features/content-renderer/index.ts';
import { structuredBlockDocument } from '../fixtures/structured-block-document.ts';

test('the explicit registry renders structured blocks as semantic React elements', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document: structuredBlockDocument, mode: 'preview' }),
  );

  assert.match(html, /<p><span>Structured <\/span><strong><span>content<\/span><\/strong>/);
  assert.match(html, /<em><span>formatting<\/span><\/em>/);
  assert.match(html, /<code><span>safe\(\)<\/span><\/code>/);
  assert.match(
    html,
    /<a href="https:\/\/example\.com\/guide" rel="noopener noreferrer" target="_blank">/,
  );
  assert.match(html, /<ul><li><span>First item<\/span><\/li><\/ul>/);
  assert.match(html, /<ol><li><span>Second item<\/span><\/li><\/ol>/);
  assert.match(html, /<h2 id="overview">Overview<\/h2>/);
  assert.match(html, /<code data-language="go">fmt\.Println/);
  assert.match(html, /content-callout-warning/);
  assert.match(html, /<img alt="A system diagram"/);
  assert.match(html, /<th scope="col">Layer<\/th>/);
  assert.match(html, /content-divider/);
  assert.match(html, /Architecture guide/);
});

test('text is escaped and unsafe links do not become active hyperlinks', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      document: {
        schema_version: 1,
        title: 'Unsafe values',
        description: 'Renderer escaping behavior.',
        blocks: [
          {
            id: 'unsafe-rich-text',
            type: 'rich_text',
            version: 1,
            props: {
              nodes: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'text', text: '<script>alert(1)</script>' },
                    {
                      type: 'link',
                      href: 'javascript:alert(1)',
                      children: [{ type: 'text', text: 'unsafe link' }],
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'unsafe-image',
            type: 'image',
            version: 1,
            props: { src: 'data:text/html,unsafe', alt: 'bad' },
          },
        ],
      },
    }),
  );

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /unsafe link/);
  assert.match(html, /This image could not be displayed/);
});

test('unknown or malformed blocks stay visible with preview diagnostics or safe public fallback', () => {
  const document = {
    schema_version: 1,
    title: 'Unsupported blocks',
    description: 'Future and malformed blocks have safe fallbacks.',
    blocks: [
      {
        id: 'future',
        type: 'future_block',
        version: 1,
        props: { payload: '<script>bad</script>' },
      },
      { id: 'bad-code', type: 'code', version: 1, props: {} },
    ],
  };
  const previewHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document, mode: 'preview' }),
  );
  const publicHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document, mode: 'public' }),
  );

  assert.match(previewHtml, /Unsupported content block: <code>future_block<\/code>/);
  assert.match(previewHtml, /Unsupported content block: <code>code<\/code>/);
  assert.match(publicHtml, /This part of the content is not available/);
  assert.doesNotMatch(previewHtml, /<script>/);
  assert.doesNotMatch(publicHtml, /future_block/);
});

test('documents with duplicate block ids are rejected before rendering', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      document: {
        schema_version: 1,
        title: 'Duplicate ids',
        description: 'Block ids are unique in V1 documents.',
        blocks: [
          { id: 'same-id', type: 'divider', version: 1, props: {} },
          { id: 'same-id', type: 'divider', version: 1, props: {} },
        ],
      },
    }),
  );

  assert.match(html, /This content document is not available in this version/);
  assert.doesNotMatch(html, /content-divider/);
});
