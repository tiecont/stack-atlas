import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { DefaultTreeAdapterMap } from 'parse5';
import { parseArticleHtml } from '@/lib/content/html';
import { withBasePath } from '@/lib/content/urls';

type Node = DefaultTreeAdapterMap['childNode'];
type Element = DefaultTreeAdapterMap['element'];
type Fragment = DefaultTreeAdapterMap['documentFragment'];

const safeTags = new Set([
  'a', 'b', 'blockquote', 'br', 'circle', 'code', 'defs', 'div', 'em', 'figcaption', 'figure', 'g', 'h2', 'h3', 'h4',
  'line', 'lineargradient', 'li', 'marker', 'ol', 'p', 'path', 'polyline', 'pre', 'rect', 'section', 'span', 'stop',
  'strong', 'svg', 'table', 'tbody', 'td', 'text', 'th', 'thead', 'tr', 'ul',
]);
const blockedTags = new Set(['iframe', 'object', 'embed', 'script', 'style', 'form', 'input', 'button', 'video', 'audio']);
const svgAttributes = new Set([
  'viewbox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'font-size',
  'font-weight', 'text-anchor', 'marker-end', 'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'offset', 'stop-color', 'transform',
]);
const attributeNames: Record<string, string> = {
  class: 'className', for: 'htmlFor', viewbox: 'viewBox', 'fill-rule': 'fillRule', 'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'stroke-dasharray': 'strokeDasharray',
  'font-size': 'fontSize', 'font-weight': 'fontWeight', 'text-anchor': 'textAnchor', 'marker-end': 'markerEnd',
  markerwidth: 'markerWidth', markerheight: 'markerHeight', refx: 'refX', refy: 'refY', 'stop-color': 'stopColor',
};

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;
  if (trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed, 'https://stack-atlas.invalid');
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return parsed.origin === 'https://stack-atlas.invalid' ? withBasePath(trimmed) : trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function safeStyle(value: string): CSSProperties | undefined {
  if (/url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) return undefined;
  const allowed = new Set(['color', 'background', 'fill', 'stroke', 'font-size', 'font-weight', 'text-anchor', 'stroke-width', 'stop-color', 'stroke-linecap', 'stroke-linejoin']);
  const result: Record<string, string | number> = {};
  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 1) continue;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const setting = declaration.slice(separator + 1).trim();
    if (allowed.has(name) && setting && !/[<>]/.test(setting)) {
      result[attributeNames[name] ?? name] = setting;
    }
  }
  return Object.keys(result).length ? result as CSSProperties : undefined;
}

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function renderNode(node: Node, key: number): ReactNode {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if (!isElement(node)) return null;
  const tag = node.tagName;
  if (blockedTags.has(tag)) return null;
  const children = 'childNodes' in node ? node.childNodes.map((child, index) => renderNode(child, index)) : [];
  if (!safeTags.has(tag)) return <>{children}</>;
  const props: Record<string, unknown> = { key };
  for (const attribute of node.attrs) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name === 'href') {
      const href = safeHref(value);
      if (href) props.href = href;
    } else if (name === 'target') {
      if (value === '_blank' || value === '_self') props.target = value;
    } else if (name === 'rel') {
      props.rel = value;
    } else if (name === 'style') {
      const style = safeStyle(value);
      if (style) props.style = style;
    } else if (name.startsWith('aria-') || name.startsWith('data-')) {
      props[name] = value;
    } else if (['id', 'class', 'title', 'role', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'offset', 'orient', 'transform'].includes(name) || svgAttributes.has(name)) {
      props[attributeNames[name] ?? name] = value;
    }
  }
  if (tag === 'a' && props.target === '_blank') props.rel = typeof props.rel === 'string' ? `${props.rel} noopener noreferrer` : 'noopener noreferrer';
  const reactTag = tag === 'lineargradient' ? 'linearGradient' : tag;
  return createElement(reactTag, props, ...children);
}

export function ArticleContent({ html }: { html: string }) {
  const fragment = parseArticleHtml(html) as Fragment;
  return <>{fragment.childNodes.map((node, index) => renderNode(node, index))}</>;
}
