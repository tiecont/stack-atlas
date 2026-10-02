import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_BLOCK_TYPES_V1 } from '@/features/content-renderer/types';
import {
  createDefaultBlock,
  duplicateBlock,
  insertBlock,
  makeInlineNode,
  moveBlock,
  removeBlock,
  validateEditorDocument,
} from '@/features/admin-content/content-editor-model';

const blocks = CONTENT_BLOCK_TYPES_V1.map((type, index) =>
  createDefaultBlock(type, `block-${index + 1}`),
);

test('editor model adds, removes, reorders, and duplicates blocks with stable unique identities', () => {
  const appended = insertBlock(blocks, createDefaultBlock('divider', 'block-added'));
  assert.equal(appended.length, blocks.length + 1);
  assert.equal(
    removeBlock(appended, 'block-1').some((block) => block.id === 'block-1'),
    false,
  );

  const moved = moveBlock(blocks, 'block-2', -1);
  assert.equal(moved[0]?.id, 'block-2');
  assert.equal(moved[1]?.id, 'block-1');
  assert.equal(moveBlock(blocks, 'block-1', -1)[0]?.id, 'block-1');

  const duplicated = duplicateBlock(blocks, 'block-3', 'block-copy');
  assert.equal(duplicated[3]?.id, 'block-copy');
  assert.equal(duplicated[3]?.type, blocks[2]?.type);
  assert.equal(duplicateBlock(blocks, 'block-3', 'block-1').length, blocks.length);
});

test('rich-text inline controls serialize semantic V1 nodes without HTML', () => {
  const plainText = { type: 'text', text: 'Readable text' };
  const bold = makeInlineNode('bold', plainText);
  const link = makeInlineNode('link', {
    type: 'link',
    href: '/guide',
    children: [bold],
  });

  assert.deepEqual(bold, { type: 'bold', children: [{ type: 'text', text: 'Readable text' }] });
  assert.deepEqual(link, {
    type: 'link',
    href: '/guide',
    children: [{ type: 'bold', children: [{ type: 'text', text: 'Readable text' }] }],
  });
  assert.equal(JSON.stringify(link).includes('<'), false);
});

test('default blocks cover all V1 types and validate as a canonical document', () => {
  assert.deepEqual(
    blocks.map((block) => block.type),
    CONTENT_BLOCK_TYPES_V1,
  );
  assert.deepEqual(
    validateEditorDocument({
      schema_version: 1,
      title: 'Editor model',
      description: 'A structured document.',
      blocks,
    }),
    [],
  );
});

test('editor validation identifies invalid metadata, duplicate IDs, and unsafe block props', () => {
  const invalid = [
    ...blocks.slice(0, 1),
    { id: 'block-1', type: 'image', version: 1, props: { src: 'javascript:alert(1)', alt: '' } },
  ];
  const issues = validateEditorDocument({
    schema_version: 1,
    title: '',
    description: ' '.repeat(501),
    blocks: invalid,
  });

  assert.ok(issues.some((issue) => issue.target === 'document-title'));
  assert.ok(issues.some((issue) => issue.target === 'document-description'));
  assert.ok(
    issues.some(
      (issue) => issue.target === 'editor-block-block-1' && /more than once/.test(issue.message),
    ),
  );
  assert.ok(
    issues.some(
      (issue) => issue.target === 'editor-block-block-1' && /unsafe URL/.test(issue.message),
    ),
  );
});
