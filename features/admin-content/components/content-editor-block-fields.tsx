'use client';

import type {
  ContentBlock,
  InlineContentNode,
  RichTextNode,
} from '@/features/content-renderer/types';
import { makeInlineNode } from '../content-editor-model';
import styles from '../admin-content.module.css';

const INLINE_NODE_TYPES: readonly InlineContentNode['type'][] = [
  'text',
  'bold',
  'italic',
  'inline_code',
  'link',
];
const RICH_TEXT_NODE_TYPES: readonly RichTextNode['type'][] = [
  'paragraph',
  'bullet_list',
  'ordered_list',
];

export function ContentEditorBlockFields({
  block,
  disabled,
  issueId,
  onChange,
}: {
  block: ContentBlock;
  disabled: boolean;
  issueId?: string;
  onChange: (block: ContentBlock) => void;
}) {
  switch (block.type) {
    case 'rich_text':
      return (
        <RichTextFields block={block} disabled={disabled} issueId={issueId} onChange={onChange} />
      );
    case 'heading':
      return (
        <div className={styles.blockFieldGrid}>
          <label className={styles.fieldLabel}>
            Level
            <select
              className={styles.select}
              disabled={disabled}
              onChange={(event) => {
                const level = Number(event.target.value);
                if (level === 2 || level === 3 || level === 4) {
                  onChange({ ...block, props: { ...block.props, level } });
                }
              }}
              value={block.props.level}
            >
              <option value={2}>Heading 2</option>
              <option value={3}>Heading 3</option>
              <option value={4}>Heading 4</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            Text
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={160}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, text: event.target.value } })
              }
              required
              value={block.props.text}
            />
          </label>
          <label className={styles.fieldLabel}>
            HTML anchor
            <input
              aria-describedby={issueId}
              autoCapitalize="none"
              className={styles.input}
              disabled={disabled}
              maxLength={120}
              onChange={(event) => {
                const anchor = event.target.value;
                const props = { ...block.props };
                if (anchor) props.anchor = anchor;
                else delete props.anchor;
                onChange({ ...block, props });
              }}
              value={block.props.anchor ?? ''}
            />
          </label>
        </div>
      );
    case 'code':
      return (
        <div className={styles.blockFieldGrid}>
          <label className={styles.fieldLabel}>
            Language
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={40}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, language: event.target.value } })
              }
              required
              value={block.props.language}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.fieldSpan}`}>
            Code
            <textarea
              aria-describedby={issueId}
              className={`${styles.textarea} ${styles.codeInput}`}
              disabled={disabled}
              maxLength={100_000}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, code: event.target.value } })
              }
              value={block.props.code}
            />
          </label>
        </div>
      );
    case 'callout':
      return (
        <div className={styles.blockFieldGrid}>
          <label className={styles.fieldLabel}>
            Tone
            <select
              className={styles.select}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value === 'info' || event.target.value === 'warning') {
                  onChange({ ...block, props: { ...block.props, tone: event.target.value } });
                }
              }}
              value={block.props.tone}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            Title
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={160}
              onChange={(event) => {
                const title = event.target.value;
                const props = { ...block.props };
                if (title) props.title = title;
                else delete props.title;
                onChange({ ...block, props });
              }}
              value={block.props.title ?? ''}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.fieldSpan}`}>
            Text
            <textarea
              aria-describedby={issueId}
              className={styles.textarea}
              disabled={disabled}
              maxLength={10_000}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, text: event.target.value } })
              }
              required
              value={block.props.text}
            />
          </label>
        </div>
      );
    case 'image':
      return (
        <div className={styles.blockFieldGrid}>
          <label className={styles.fieldLabel}>
            Source
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={2048}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, src: event.target.value } })
              }
              required
              value={block.props.src}
            />
          </label>
          <label className={styles.fieldLabel}>
            Alt text
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={1000}
              onChange={(event) =>
                onChange({ ...block, props: { ...block.props, alt: event.target.value } })
              }
              value={block.props.alt}
            />
          </label>
          <label className={`${styles.fieldLabel} ${styles.fieldSpan}`}>
            Caption
            <input
              aria-describedby={issueId}
              className={styles.input}
              disabled={disabled}
              maxLength={500}
              onChange={(event) => {
                const caption = event.target.value;
                const props = { ...block.props };
                if (caption) props.caption = caption;
                else delete props.caption;
                onChange({ ...block, props });
              }}
              value={block.props.caption ?? ''}
            />
          </label>
        </div>
      );
    case 'table':
      return (
        <TableFields block={block} disabled={disabled} issueId={issueId} onChange={onChange} />
      );
    case 'divider':
      return <p className={styles.fieldHint}>Horizontal divider</p>;
    case 'related_content':
      return (
        <RelatedContentFields
          block={block}
          disabled={disabled}
          issueId={issueId}
          onChange={onChange}
        />
      );
  }
}

function RichTextFields({
  block,
  disabled,
  issueId,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'rich_text' }>;
  disabled: boolean;
  issueId?: string;
  onChange: (block: ContentBlock) => void;
}) {
  function updateNode(index: number, next: RichTextNode) {
    const nodes = [...block.props.nodes];
    nodes[index] = next;
    onChange({ ...block, props: { nodes } });
  }

  function removeNode(index: number) {
    onChange({
      ...block,
      props: { nodes: block.props.nodes.filter((_, current) => current !== index) },
    });
  }

  return (
    <div className={styles.richTextEditor} aria-describedby={issueId}>
      {block.props.nodes.map((node, index) => (
        <section className={styles.richNode} key={index}>
          <div className={styles.collectionHeader}>
            <label className={styles.fieldLabel}>
              Text structure
              <select
                className={styles.select}
                disabled={disabled}
                onChange={(event) => {
                  const type = RICH_TEXT_NODE_TYPES.find(
                    (candidate) => candidate === event.target.value,
                  );
                  if (type) updateNode(index, changeRichTextNodeType(node, type));
                }}
                value={node.type}
              >
                <option value="paragraph">Paragraph</option>
                <option value="bullet_list">Bullet list</option>
                <option value="ordered_list">Numbered list</option>
              </select>
            </label>
            <button
              aria-label={`Remove text structure ${index + 1}`}
              className={styles.editorTextButton}
              disabled={disabled || block.props.nodes.length === 1}
              onClick={() => removeNode(index)}
              type="button"
            >
              Remove
            </button>
          </div>
          {node.type === 'paragraph' ? (
            <InlineNodesFields
              disabled={disabled}
              nodes={node.children}
              onChange={(children) => updateNode(index, { ...node, children })}
            />
          ) : (
            <div className={styles.listItems}>
              {node.items.map((item, itemIndex) => (
                <div className={styles.listItemEditor} key={itemIndex}>
                  <span className={styles.itemNumber}>{itemIndex + 1}</span>
                  <InlineNodesFields
                    disabled={disabled}
                    nodes={item}
                    onChange={(children) => {
                      const items = [...node.items];
                      items[itemIndex] = children;
                      updateNode(index, { ...node, items });
                    }}
                  />
                  <button
                    aria-label={`Remove list item ${itemIndex + 1}`}
                    className={styles.editorTextButton}
                    disabled={disabled || node.items.length === 1}
                    onClick={() =>
                      updateNode(index, {
                        ...node,
                        items: node.items.filter((_, current) => current !== itemIndex),
                      })
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className={styles.editorTextButton}
                disabled={disabled || node.items.length >= 100}
                onClick={() =>
                  updateNode(index, { ...node, items: [...node.items, [emptyInlineText()]] })
                }
                type="button"
              >
                Add list item
              </button>
            </div>
          )}
        </section>
      ))}
      <button
        className={styles.secondaryButton}
        disabled={disabled || block.props.nodes.length >= 500}
        onClick={() =>
          onChange({ ...block, props: { nodes: [...block.props.nodes, emptyRichTextNode()] } })
        }
        type="button"
      >
        Add paragraph or list
      </button>
    </div>
  );
}

function InlineNodesFields({
  disabled,
  nodes,
  onChange,
  depth = 0,
}: {
  disabled: boolean;
  nodes: InlineContentNode[];
  onChange: (nodes: InlineContentNode[]) => void;
  depth?: number;
}) {
  return (
    <div className={styles.inlineNodes}>
      {nodes.map((node, index) => (
        <div className={styles.inlineNode} key={index}>
          <InlineNodeFields
            depth={depth}
            disabled={disabled}
            node={node}
            onChange={(updated) => {
              const next = [...nodes];
              next[index] = updated;
              onChange(next);
            }}
          />
          <button
            aria-label={`Remove inline ${node.type} node`}
            className={styles.editorTextButton}
            disabled={disabled || nodes.length === 1}
            onClick={() => onChange(nodes.filter((_, current) => current !== index))}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        className={styles.editorTextButton}
        disabled={disabled || nodes.length >= 500 || depth >= 16}
        onClick={() => onChange([...nodes, emptyInlineText()])}
        type="button"
      >
        Add text node
      </button>
    </div>
  );
}

function InlineNodeFields({
  depth,
  disabled,
  node,
  onChange,
}: {
  depth: number;
  disabled: boolean;
  node: InlineContentNode;
  onChange: (node: InlineContentNode) => void;
}) {
  return (
    <div className={styles.inlineNodeFields}>
      <label className={styles.fieldLabel}>
        Format
        <select
          className={styles.select}
          disabled={disabled}
          onChange={(event) => {
            const type = INLINE_NODE_TYPES.find((candidate) => candidate === event.target.value);
            if (type) onChange(makeInlineNode(type, node));
          }}
          value={node.type}
        >
          <option value="text">Text</option>
          <option value="bold">Bold</option>
          <option value="italic">Italic</option>
          <option value="inline_code">Inline code</option>
          <option value="link">Link</option>
        </select>
      </label>
      {node.type === 'text' ? (
        <label className={`${styles.fieldLabel} ${styles.inlineTextField}`}>
          Text
          <input
            className={styles.input}
            disabled={disabled}
            maxLength={10_000}
            onChange={(event) => onChange({ ...node, text: event.target.value })}
            value={node.text}
          />
        </label>
      ) : (
        <div className={styles.inlineChildren}>
          {node.type === 'link' && (
            <label className={styles.fieldLabel}>
              Link URL
              <input
                className={styles.input}
                disabled={disabled}
                maxLength={2048}
                onChange={(event) => onChange({ ...node, href: event.target.value })}
                value={node.href}
              />
            </label>
          )}
          <InlineNodesFields
            depth={depth + 1}
            disabled={disabled}
            nodes={node.children}
            onChange={(children) => onChange({ ...node, children })}
          />
        </div>
      )}
    </div>
  );
}

function TableFields({
  block,
  disabled,
  issueId,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'table' }>;
  disabled: boolean;
  issueId?: string;
  onChange: (block: ContentBlock) => void;
}) {
  function updateHeaders(headers: string[]) {
    onChange({
      ...block,
      props: {
        ...block.props,
        headers,
        rows: block.props.rows.map((row) => headers.map((_, index) => row[index] ?? '')),
      },
    });
  }

  function updateCell(rowIndex: number, cellIndex: number, value: string) {
    const rows = block.props.rows.map((row, index) =>
      index === rowIndex ? row.map((cell, column) => (column === cellIndex ? value : cell)) : row,
    );
    onChange({ ...block, props: { ...block.props, rows } });
  }

  return (
    <div className={styles.tableEditor} aria-describedby={issueId}>
      <div className={styles.tableEditorScroll}>
        <table>
          <thead>
            <tr>
              {block.props.headers.map((header, column) => (
                <th key={column}>
                  <label className={styles.fieldLabel}>
                    Header {column + 1}
                    <input
                      className={styles.input}
                      disabled={disabled}
                      maxLength={500}
                      onChange={(event) => {
                        const headers = [...block.props.headers];
                        headers[column] = event.target.value;
                        updateHeaders(headers);
                      }}
                      value={header}
                    />
                  </label>
                </th>
              ))}
              <th>Row</th>
            </tr>
          </thead>
          <tbody>
            {block.props.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => (
                  <td key={column}>
                    <label className={styles.fieldLabel}>
                      Row {rowIndex + 1}, column {column + 1}
                      <input
                        className={styles.input}
                        disabled={disabled}
                        maxLength={2000}
                        onChange={(event) => updateCell(rowIndex, column, event.target.value)}
                        value={cell}
                      />
                    </label>
                  </td>
                ))}
                <td>
                  <button
                    aria-label={`Remove table row ${rowIndex + 1}`}
                    className={styles.editorTextButton}
                    disabled={disabled || block.props.rows.length === 1}
                    onClick={() =>
                      onChange({
                        ...block,
                        props: {
                          ...block.props,
                          rows: block.props.rows.filter((_, index) => index !== rowIndex),
                        },
                      })
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.collectionActions}>
        <button
          className={styles.editorTextButton}
          disabled={disabled || block.props.headers.length >= 20}
          onClick={() =>
            updateHeaders([...block.props.headers, `Column ${block.props.headers.length + 1}`])
          }
          type="button"
        >
          Add column
        </button>
        <button
          className={styles.editorTextButton}
          disabled={disabled || block.props.headers.length === 1}
          onClick={() => updateHeaders(block.props.headers.slice(0, -1))}
          type="button"
        >
          Remove column
        </button>
        <button
          className={styles.editorTextButton}
          disabled={disabled || block.props.rows.length >= 100}
          onClick={() =>
            onChange({
              ...block,
              props: {
                ...block.props,
                rows: [...block.props.rows, block.props.headers.map(() => '')],
              },
            })
          }
          type="button"
        >
          Add row
        </button>
      </div>
      <label className={styles.fieldLabel}>
        Caption
        <input
          className={styles.input}
          disabled={disabled}
          maxLength={500}
          onChange={(event) => {
            const caption = event.target.value;
            const props = { ...block.props };
            if (caption) props.caption = caption;
            else delete props.caption;
            onChange({ ...block, props });
          }}
          value={block.props.caption ?? ''}
        />
      </label>
    </div>
  );
}

function RelatedContentFields({
  block,
  disabled,
  issueId,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'related_content' }>;
  disabled: boolean;
  issueId?: string;
  onChange: (block: ContentBlock) => void;
}) {
  return (
    <div className={styles.relatedItems} aria-describedby={issueId}>
      {block.props.items.map((item, index) => (
        <section className={styles.relatedItem} key={index}>
          <div className={styles.collectionHeader}>
            <h4>Related item {index + 1}</h4>
            <button
              aria-label={`Remove related item ${index + 1}`}
              className={styles.editorTextButton}
              disabled={disabled || block.props.items.length === 1}
              onClick={() =>
                onChange({
                  ...block,
                  props: { items: block.props.items.filter((_, current) => current !== index) },
                })
              }
              type="button"
            >
              Remove
            </button>
          </div>
          <div className={styles.blockFieldGrid}>
            <label className={styles.fieldLabel}>
              Title
              <input
                className={styles.input}
                disabled={disabled}
                maxLength={160}
                onChange={(event) => {
                  const items = [...block.props.items];
                  items[index] = { ...item, title: event.target.value };
                  onChange({ ...block, props: { items } });
                }}
                required
                value={item.title}
              />
            </label>
            <label className={styles.fieldLabel}>
              URL
              <input
                className={styles.input}
                disabled={disabled}
                maxLength={2048}
                onChange={(event) => {
                  const items = [...block.props.items];
                  items[index] = { ...item, href: event.target.value };
                  onChange({ ...block, props: { items } });
                }}
                required
                value={item.href}
              />
            </label>
            <label className={`${styles.fieldLabel} ${styles.fieldSpan}`}>
              Description
              <input
                className={styles.input}
                disabled={disabled}
                maxLength={500}
                onChange={(event) => {
                  const items = [...block.props.items];
                  const description = event.target.value;
                  if (description) items[index] = { ...item, description };
                  else {
                    const next = { ...item };
                    delete next.description;
                    items[index] = next;
                  }
                  onChange({ ...block, props: { items } });
                }}
                value={item.description ?? ''}
              />
            </label>
          </div>
        </section>
      ))}
      <button
        className={styles.secondaryButton}
        disabled={disabled || block.props.items.length >= 20}
        onClick={() =>
          onChange({
            ...block,
            props: {
              items: [...block.props.items, { title: '', href: '' }],
            },
          })
        }
        type="button"
      >
        Add related item
      </button>
    </div>
  );
}

function changeRichTextNodeType(node: RichTextNode, type: RichTextNode['type']): RichTextNode {
  if (type === 'paragraph') {
    const separator: InlineContentNode = { type: 'text', text: ' ' };
    const children: InlineContentNode[] =
      node.type === 'paragraph'
        ? node.children
        : node.items.flatMap((item, index) => (index === 0 ? item : [separator, ...item]));
    return {
      type,
      children: children.length ? children : [emptyInlineText()],
    };
  }
  if (node.type !== 'paragraph') return { ...node, type };
  return { type, items: [node.children] };
}

function emptyInlineText(): InlineContentNode {
  return { type: 'text', text: '' };
}

function emptyRichTextNode(): RichTextNode {
  return { type: 'paragraph', children: [emptyInlineText()] };
}
