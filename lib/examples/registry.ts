export type ExampleDefinition = {
  id: string;
  title: string;
  directory: string;
  guide: string;
  publicFiles: readonly string[];
};

export const examples: readonly ExampleDefinition[] = [
  {
    id: 'atlas-demo-api',
    title: 'atlas-demo-api',
    directory: 'atlas-demo-api',
    guide: 'README.md',
    publicFiles: [
      '.dockerignore',
      'Dockerfile',
      'Makefile',
      'cmd/server/main.go',
      'go.mod',
    ],
  },
];

export function getExample(id: string): ExampleDefinition | undefined {
  return examples.find((example) => example.id === id);
}

export function isExamplePublicRoute(pathname: string): boolean {
  const route = pathname.replace(/\/$/, '');
  const guide = route.match(/^\/examples\/([^/]+)$/);
  if (guide) return getExample(guide[1]) !== undefined;

  const file = route.match(/^\/examples\/([^/]+)\/files\/(.+)$/);
  return !!file && !!getExample(file[1])?.publicFiles.includes(file[2]);
}

export function exampleRuntimeFiles(): string[] {
  return examples.flatMap((example) => [
    `./examples/${example.directory}/${example.guide}`,
    ...example.publicFiles.map((file) => `./examples/${example.directory}/${file}`),
  ]);
}
