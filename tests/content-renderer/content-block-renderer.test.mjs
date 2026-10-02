import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { CONTENT_BLOCK_RENDERER_REGISTRY } from '../../features/content-renderer/components/block-renderer.tsx';
import { BlockRenderer } from '../../features/content-renderer/index.ts';
import {
  CONTENT_BLOCK_TYPES_V1,
  isContentBlock,
  parseContentDocumentV1,
} from '../../features/content-renderer/types.ts';
import { structuredBlockDocument } from '../fixtures/structured-block-document.ts';

test('the renderer registry and canonical fixture cover every supported V1 block type', () => {
  const supportedTypes = [...CONTENT_BLOCK_TYPES_V1].sort();
  const registryTypes = Object.keys(CONTENT_BLOCK_RENDERER_REGISTRY).sort();
  const fixtureTypes = [
    ...new Set(structuredBlockDocument.blocks.map((block) => block.type)),
  ].sort();

  assert.deepEqual(registryTypes, supportedTypes);
  assert.deepEqual(fixtureTypes, supportedTypes);
});

test('the runtime parser accepts canonical external data and rejects invalid document envelopes', () => {
  assert.ok(parseContentDocumentV1(structuredBlockDocument));
  assert.equal(parseContentDocumentV1({ ...structuredBlockDocument, schema_version: 2 }), null);
  assert.equal(parseContentDocumentV1({ ...structuredBlockDocument, unsupported: true }), null);
});

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

test('text is escaped when rendering a valid rich-text block', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      document: {
        schema_version: 1,
        title: 'Unsafe values',
        description: 'Renderer escaping behavior.',
        blocks: [
          {
            id: 'escaped-rich-text',
            type: 'rich_text',
            version: 1,
            props: {
              nodes: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '<script>alert(1)</script>' }],
                },
              ],
            },
          },
        ],
      },
    }),
  );

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('unsafe link, image, and related-content URLs are rejected by the V1 renderer', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, {
      document: {
        schema_version: 1,
        title: 'Unsafe URLs',
        description: 'Executable schemes and credential URLs are not persisted V1.',
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
          {
            id: 'unsafe-related',
            type: 'related_content',
            version: 1,
            props: {
              items: [{ title: 'Unsafe', href: 'https://user:secret@example.com/' }],
            },
          },
        ],
      },
      mode: 'preview',
    }),
  );

  assert.match(html, /Unsupported content block: <code>rich_text<\/code>/);
  assert.match(html, /Unsupported content block: <code>image<\/code>/);
  assert.match(html, /Unsupported content block: <code>related_content<\/code>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /src="data:/);
  assert.doesNotMatch(html, /user:secret/);
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
      { id: 'future-version', type: 'divider', version: 2, props: {} },
      { id: 'extra-prop', type: 'divider', version: 1, props: { visible: true } },
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
  assert.match(previewHtml, /Unsupported content block: <code>divider<\/code>/);
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

test('the heading block id stays separate from its optional rendered anchor', () => {
  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document: structuredBlockDocument }),
  );

  assert.match(html, /<h2 id="overview">Overview<\/h2>/);
  assert.doesNotMatch(html, /<h2 id="heading-overview">/);
});

test('accepts lowercase Unicode anchors and rejects uppercase anchors', () => {
  const unicodeAnchorDocument = structuredClone(structuredBlockDocument);
  const heading = unicodeAnchorDocument.blocks.find((block) => block.type === 'heading');
  assert.ok(heading);
  heading.props['anchor'] = 'uu-điem';
  assert.ok(isContentBlock(heading));

  heading.props['anchor'] = 'Uu-điem';
  assert.equal(isContentBlock(heading), false);
});

test('table row shape is validated before dispatch to the renderer', () => {
  const document = structuredClone(structuredBlockDocument);
  const table = document.blocks.find((block) => block.type === 'table');
  assert.ok(table);
  table.props['rows'] = [['one cell']];

  const html = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document, mode: 'preview' }),
  );
  assert.match(html, /Unsupported content block: <code>table<\/code>/);
  assert.doesNotMatch(html, /<table/);
});

test('document and code byte limits are enforced before rendering content', () => {
  const oversizedDocument = {
    schema_version: 1,
    title: 'Oversized',
    description: 'Document byte limit.',
    blocks: [
      {
        id: 'body',
        type: 'rich_text',
        version: 1,
        props: {
          nodes: [{ type: 'paragraph', children: [{ type: 'text', text: 'x'.repeat(1_048_500) }] }],
        },
      },
    ],
  };
  const documentHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document: oversizedDocument }),
  );

  const oversizedCode = {
    schema_version: 1,
    title: 'Oversized code',
    description: 'Code byte limit.',
    blocks: [
      {
        id: 'code',
        type: 'code',
        version: 1,
        props: { language: 'text', code: '€'.repeat(33_334) },
      },
    ],
  };
  const codeHtml = renderToStaticMarkup(
    React.createElement(BlockRenderer, { document: oversizedCode, mode: 'preview' }),
  );

  assert.match(documentHtml, /This content document is not available in this version/);
  assert.match(codeHtml, /Unsupported content block: <code>code<\/code>/);
  assert.doesNotMatch(codeHtml, /€{20}/);
});
