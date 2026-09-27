export type LabDefinition = {
  id: string;
  title: string;
  directory: string;
  guide: string;
  publicFiles: readonly string[];
};

export const labs: readonly LabDefinition[] = [
  {
    id: 'kubernetes-cluster',
    title: 'Local kind cluster',
    directory: 'kubernetes/00-cluster',
    guide: 'README.md',
    publicFiles: ['kind-config.yaml', 'version-matrix.yaml'],
  },
  {
    id: 'kubernetes-foundations',
    title: 'Kubernetes foundations',
    directory: 'kubernetes/01-foundations',
    guide: 'README.md',
    publicFiles: [
      'manifests/00-namespace.yaml',
      'manifests/10-deployment.yaml',
      'manifests/20-service.yaml',
      'scripts/delete-managed-pod.sh',
      'scripts/verify.sh',
    ],
  },
];

export function getLab(id: string): LabDefinition | undefined {
  return labs.find((lab) => lab.id === id);
}

export function isLabPublicRoute(pathname: string): boolean {
  const route = pathname.replace(/\/$/, '');
  const guide = route.match(/^\/labs\/([^/]+)$/);
  if (guide) return getLab(guide[1]) !== undefined;

  const file = route.match(/^\/labs\/([^/]+)\/files\/(.+)$/);
  return !!file && !!getLab(file[1])?.publicFiles.includes(file[2]);
}

export function labRuntimeFiles(): string[] {
  return labs.flatMap((lab) => [
    `./labs/${lab.directory}/${lab.guide}`,
    ...lab.publicFiles.map((file) => `./labs/${lab.directory}/${file}`),
  ]);
}
