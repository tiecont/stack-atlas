const LOCAL_URL_ORIGIN = 'https://stack-atlas.invalid';

export function isSafeHref(href: string): boolean {
  if (isSafeLocalPath(href) || href.startsWith('#')) return true;
  try {
    const parsed = new URL(href);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

export function isSafeImageSrc(src: string): boolean {
  if (isSafeLocalPath(src)) return true;
  try {
    const parsed = new URL(src);
    return (
      parsed.protocol === 'https:' && parsed.username.length === 0 && parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

export function resolveSafeHref(href: string): { href: string; external: boolean } | null {
  if (isSafeLocalPath(href) || href.startsWith('#')) {
    return { href, external: false };
  }

  if (!isSafeHref(href)) return null;
  try {
    return { href: new URL(href).toString(), external: true };
  } catch {
    return null;
  }
}

export function resolveSafeImageSrc(src: string): string | null {
  if (isSafeLocalPath(src)) return src;
  if (!isSafeImageSrc(src)) return null;
  try {
    return new URL(src).toString();
  } catch {
    return null;
  }
}

function isSafeLocalPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  try {
    return new URL(value, LOCAL_URL_ORIGIN).origin === LOCAL_URL_ORIGIN;
  } catch {
    return false;
  }
}
