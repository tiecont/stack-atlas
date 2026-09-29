import { examples } from './examples/registry.ts';
import { labs } from './labs/registry.ts';

export type PublicContentRedirect = {
  source: string;
  destination: string;
};

function redirectsFor(
  root: 'labs' | 'examples',
  items: ReadonlyArray<{
    id: string;
    directory: string;
    guide: string;
    publicFiles: readonly string[];
  }>,
): PublicContentRedirect[] {
  return items.flatMap((item) => [
    {
      source: `/${root}/${item.directory}/${item.guide}`,
      destination: `/${root}/${item.id}/`,
    },
    ...item.publicFiles.map((file) => ({
      source: `/${root}/${item.directory}/${file}`,
      destination: `/${root}/${item.id}/files/${file}`,
    })),
  ]);
}

export function buildPublicContentRedirects(): PublicContentRedirect[] {
  return [...redirectsFor('labs', labs), ...redirectsFor('examples', examples)];
}
