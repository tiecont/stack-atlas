import { resolveSafeHref } from '../safe-link';
import type { ImageContentBlock as ImageContentBlockType } from '../../types';

function resolveSafeImageSrc(src: string): string | null {
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  try {
    const parsed = new URL(src);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function ImageBlock({ block }: { block: ImageContentBlockType }) {
  const src = resolveSafeImageSrc(block.src);
  if (!src || !resolveSafeHref(src)) {
    return <p className="content-unsupported">This image could not be displayed.</p>;
  }

  return (
    <figure className="content-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- Remote hosts are authored data and cannot be configured at build time. */}
      <img alt={block.alt} decoding="async" loading="lazy" referrerPolicy="no-referrer" src={src} />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}
