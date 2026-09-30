#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAllDocuments } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_ROOT = path.join(ROOT, 'labs/kubernetes');
const WORKLOAD_KINDS = new Set([
  'Pod',
  'Deployment',
  'ReplicaSet',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
]);
const SELECTOR_KINDS = new Set(['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet']);

type RecordValue = Record<string, unknown>;

type ValidationResult = {
  errors: string[];
  objects: number;
  files: string[];
};

type Options = {
  serverSide: boolean;
  context: string;
  kubectl: string;
};

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasEntries(value: unknown): boolean {
  return Object.keys(record(value)).length > 0;
}

function podTemplate(object: RecordValue): { labels: RecordValue; spec: RecordValue } {
  const kind = object.kind;
  const spec = record(object.spec);
  if (kind === 'Pod') {
    return {
      labels: record(record(object.metadata).labels),
      spec,
    };
  }

  const workloadSpec = kind === 'CronJob' ? record(record(spec.jobTemplate).spec) : spec;
  const template = record(workloadSpec.template);
  const metadata = record(template.metadata);
  return {
    labels: record(metadata.labels),
    spec: record(template.spec),
  };
}

export function checkManifest(relativePath: string, value: unknown): string[] {
  const object = record(value);
  const errors: string[] = [];
  const kind = object.kind;
  const apiVersion = object.apiVersion;

  if (
    kind === 'Cluster' &&
    typeof apiVersion === 'string' &&
    apiVersion.startsWith('kind.x-k8s.io/')
  ) {
    return errors;
  }

  for (const field of ['apiVersion', 'kind'] as const) {
    if (!object[field]) errors.push(`${relativePath}: missing ${field}`);
  }

  const metadata = record(object.metadata);
  if (!metadata.name) errors.push(`${relativePath}: missing metadata.name`);

  if (typeof kind === 'string' && WORKLOAD_KINDS.has(kind)) {
    const { labels, spec } = podTemplate(object);
    for (const label of [
      'app.kubernetes.io/name',
      'app.kubernetes.io/component',
      'app.kubernetes.io/part-of',
    ]) {
      if (!Object.hasOwn(labels, label)) {
        errors.push(`${relativePath}: workload is missing label ${label}`);
      }
    }

    if (SELECTOR_KINDS.has(kind)) {
      const selector = record(record(record(object.spec).selector).matchLabels);
      if (
        Object.keys(selector).length === 0 ||
        Object.entries(selector).some(([key, selected]) => labels[key] !== selected)
      ) {
        errors.push(`${relativePath}: selector.matchLabels must match Pod-template labels`);
      }
    }

    const containers = [...list(spec.containers), ...list(spec.initContainers)].map(record);
    if (containers.length === 0) errors.push(`${relativePath}: workload has no containers`);
    for (const container of containers) {
      const image = typeof container.image === 'string' ? container.image : '';
      const finalComponent = image.split('/').at(-1) ?? '';
      if (
        !image ||
        finalComponent.endsWith(':latest') ||
        (!finalComponent.includes(':') && !image.includes('@sha256:'))
      ) {
        errors.push(
          `${relativePath}: container ${String(container.name)} must use a pinned image tag or digest`,
        );
      }

      const resources = record(container.resources);
      if (!hasEntries(resources.requests) || !hasEntries(resources.limits)) {
        errors.push(
          `${relativePath}: container ${String(container.name)} needs resource requests and limits`,
        );
      }
      if (record(container.securityContext).privileged === true) {
        errors.push(`${relativePath}: privileged containers are prohibited in regular labs`);
      }
    }

    if (list(spec.volumes).some((volume) => Object.hasOwn(record(volume), 'hostPath'))) {
      errors.push(`${relativePath}: hostPath is prohibited in regular labs`);
    }
  }

  return errors;
}

function findManifestFiles(directory = MANIFEST_ROOT): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findManifestFiles(fullPath);
      if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) return [];

      const relativePath = path.relative(MANIFEST_ROOT, fullPath).split(path.sep).join('/');
      const isKindConfig = entry.name === 'kind-config.yaml';
      const isManifest = relativePath.split('/').includes('manifests');
      return isKindConfig || isManifest ? [fullPath] : [];
    })
    .sort();
}

export function validateKubernetesManifests(): ValidationResult {
  const errors: string[] = [];
  const files = findManifestFiles();
  let objects = 0;

  for (const file of files) {
    const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
    let documents;
    try {
      documents = parseAllDocuments(readFileSync(file, 'utf8'));
    } catch (cause) {
      errors.push(`${relativePath}: ${cause instanceof Error ? cause.message : String(cause)}`);
      continue;
    }

    for (const document of documents) {
      if (document.errors.length > 0) {
        document.errors.forEach((error) => errors.push(`${relativePath}: ${error.message}`));
        continue;
      }

      let object: unknown;
      try {
        object = document.toJS();
      } catch (cause) {
        errors.push(`${relativePath}: ${cause instanceof Error ? cause.message : String(cause)}`);
        continue;
      }

      // PyYAML's filter(None, documents) skips null, false, zero and empty strings.
      if (!object) continue;
      if (typeof object !== 'object' || Array.isArray(object)) {
        errors.push(`${relativePath}: each document must be an object`);
        continue;
      }
      objects += 1;
      errors.push(...checkManifest(relativePath, object));
    }
  }

  return { errors, objects, files };
}

function parseOptions(args: string[]): Options {
  let serverSide = false;
  let context = process.env.CONTEXT ?? `kind-${process.env.CLUSTER_NAME ?? 'stack-atlas'}`;
  let kubectl = process.env.KUBECTL ?? 'kubectl';
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--server-side') {
      serverSide = true;
    } else if (argument === '--context' || argument === '--kubectl') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      if (argument === '--context') context = value;
      else kubectl = value;
      index += 1;
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }
  return { serverSide, context, kubectl };
}

function outputProcessResult(result: ReturnType<typeof spawnSync>): void {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) process.stderr.write(`${result.error.message}\n`);
}

export function runValidator(args: string[]): number {
  let options: Options;
  try {
    options = parseOptions(args);
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    return 2;
  }

  if (options.serverSide) {
    const guard = path.join(ROOT, 'scripts/ci/kubernetes/assert_lab_context.sh');
    const result = spawnSync('bash', [guard], {
      cwd: ROOT,
      env: { ...process.env, CONTEXT: options.context },
      encoding: 'utf8',
    });
    outputProcessResult(result);
    if (result.status !== 0) return result.status ?? 1;
  }

  const validation = validateKubernetesManifests();
  if (options.serverSide) {
    for (const file of validation.files) {
      if (path.basename(file) === 'kind-config.yaml') continue;
      const result = spawnSync(
        options.kubectl,
        ['--context', options.context, 'apply', '--server-side', '--dry-run=server', '-f', file],
        { cwd: ROOT, encoding: 'utf8' },
      );
      if (result.status !== 0) {
        const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
        const output = [result.stdout, result.stderr]
          .filter((part): part is string => !!part)
          .join('')
          .trimEnd();
        validation.errors.push(
          `${relativePath}: API-server dry-run failed:${output ? `\n${output}` : ''}`,
        );
      }
    }
  }

  if (validation.errors.length > 0) {
    process.stderr.write('Kubernetes manifest validation failed:\n');
    validation.errors.forEach((error) => process.stderr.write(`  - ${error}\n`));
    return 1;
  }

  process.stdout.write(
    `Validated ${validation.objects} YAML documents across ${validation.files.length} Kubernetes lab files.\n`,
  );
  if (options.serverSide) {
    process.stdout.write('All Kubernetes objects passed server-side dry-run validation.\n');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runValidator(process.argv.slice(2));
}
