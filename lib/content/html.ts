import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import type { ArticleHeading } from './types.ts';

type Node = DefaultTreeAdapterMap['childNode'];
type Element = DefaultTreeAdapterMap['element'];
type Fragment = DefaultTreeAdapterMap['documentFragment'];
type Attribute = Element['attrs'][number];

export type ArticleHtmlAnalysis = {
  headings: ArticleHeading[];
  text: string;
  ids: Set<string>;
  links: Array<{ href: string; tag: string }>;
};

const isElement = (node: Node): node is Element => 'tagName' in node;

function nodeText(node: Node): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if (!('childNodes' in node)) return '';
  return node.childNodes.map(nodeText).join('');
}

function slug(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().trim()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function allElements(fragment: Fragment): Element[] {
  const elements: Element[] = [];
  const visit = (node: Node) => {
    if (isElement(node)) elements.push(node);
    if ('childNodes' in node) node.childNodes.forEach(visit);
  };
  fragment.childNodes.forEach(visit);
  return elements;
}

function attr(element: Element, name: string): Attribute | undefined {
  return element.attrs.find(item => item.name === name);
}

export function analyzeArticleHtml(html: string): ArticleHtmlAnalysis {
  const fragment = parseFragment(html);
  const elements = allElements(fragment);
  const ids = new Set<string>();
  const reserved = new Set<string>();
  for (const element of elements) {
    const id = attr(element, 'id')?.value;
    if (id) {
      ids.add(id);
      reserved.add(id);
    }
  }

  const headings: ArticleHeading[] = [];
  const counts = new Map<string, number>();
  for (const element of elements) {
    if (element.tagName !== 'h2' && element.tagName !== 'h3') continue;
    const title = nodeText(element).replace(/\s+/g, ' ').trim();
    const existingId = attr(element, 'id')?.value;
    let headingId = existingId;
    if (!headingId) {
      const base = slug(title) || 'section';
      let suffix = counts.get(base) ?? 1;
      let candidate = base;
      while (reserved.has(candidate)) candidate = `${base}-${++suffix}`;
      counts.set(base, suffix);
      headingId = candidate;
      reserved.add(candidate);
      ids.add(candidate);
      element.attrs.push({ name: 'id', value: candidate });
    }
    headings.push({ level: element.tagName === 'h2' ? 2 : 3, id: headingId, title });
  }

  const text = elements.length
    ? fragment.childNodes.map(nodeText).join(' ').replace(/\s+/g, ' ').trim()
    : '';
  const links = elements.flatMap(element => {
    const href = attr(element, 'href')?.value ?? attr(element, 'src')?.value;
    return href ? [{ href, tag: element.tagName }] : [];
  });
  return { headings, text, ids, links };
}

export function parseArticleHtml(html: string): Fragment {
  const fragment = parseFragment(html);
  analyzeArticleHtmlOnFragment(fragment);
  return fragment;
}

function analyzeArticleHtmlOnFragment(fragment: Fragment): void {
  const elements = allElements(fragment);
  const reserved = new Set(elements.flatMap(element => {
    const id = attr(element, 'id')?.value;
    return id ? [id] : [];
  }));
  const counts = new Map<string, number>();
  for (const element of elements) {
    if (element.tagName !== 'h2' && element.tagName !== 'h3' || attr(element, 'id')) continue;
    const base = slug(nodeText(element).replace(/\s+/g, ' ').trim()) || 'section';
    let suffix = counts.get(base) ?? 1;
    let candidate = base;
    while (reserved.has(candidate)) candidate = `${base}-${++suffix}`;
    counts.set(base, suffix);
    reserved.add(candidate);
    element.attrs.push({ name: 'id', value: candidate });
  }
}
