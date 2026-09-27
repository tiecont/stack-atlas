import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

type PublicFileDefinition = {
  directory: string;
  guide: string;
  publicFiles: readonly string[];
};

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
}

export function unregisteredRuntimeFiles(
  root: 'labs' | 'examples',
  definitions: ReadonlyArray<PublicFileDefinition>,
): string[] {
  const registered = new Set(
    definitions.flatMap(({ directory, guide, publicFiles }) => [
      path.join(root, directory, guide),
      ...publicFiles.map((file) => path.join(root, directory, file)),
    ]),
  );

  return sourceFiles(path.join(process.cwd(), root))
    .map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'))
    .filter((file) => !registered.has(file))
    .map((file) => `./${file}`)
    .sort();
}
