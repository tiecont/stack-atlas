import { resolveSafeImageSrc } from '../../safe-url';
import type { ImageContentBlock as ImageContentBlockType } from '../../types';
import { sitePath } from '@/lib/site-path';

export function ImageBlock({ block }: { block: ImageContentBlockType }) {
  const src = resolveSafeImageSrc(block.src);
  if (!src) {
    return <p className="content-unsupported">This image could not be displayed.</p>;
  }

  return (
    <figure className="content-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- Remote hosts are authored data and cannot be configured at build time. */}
      <img
        alt={block.alt}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={src.startsWith('/') ? sitePath(src) : src}
      />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}
