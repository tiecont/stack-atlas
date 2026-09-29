import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkManifest,
  validateKubernetesManifests,
} from '../scripts/ci/validate-kubernetes-manifests.ts';

test('validates the Kubernetes lab manifest inventory with the TypeScript validator', () => {
  const result = validateKubernetesManifests();
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.length, 4);
  assert.equal(result.objects, 4);
  assert.ok(result.files.every((file) => !file.endsWith('/version-matrix.yaml')));
});

test('preserves safe-workload and pinned-image validation checks', () => {
  const valid = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'demo' },
    spec: {
      selector: { matchLabels: { 'app.kubernetes.io/name': 'demo' } },
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': 'demo',
            'app.kubernetes.io/component': 'api',
            'app.kubernetes.io/part-of': 'stack-atlas',
          },
        },
        spec: {
          containers: [
            {
              name: 'api',
              image: 'ghcr.io/example/demo:v1.2.3',
              resources: {
                requests: { cpu: '100m', memory: '32Mi' },
                limits: { cpu: '500m', memory: '64Mi' },
              },
            },
          ],
        },
      },
    },
  };
  assert.deepEqual(checkManifest('valid.yaml', valid), []);

  const unsafe = structuredClone(valid);
  unsafe.spec.template.metadata.labels['app.kubernetes.io/name'] = 'different';
  delete unsafe.spec.template.metadata.labels['app.kubernetes.io/component'];
  unsafe.spec.template.spec.containers[0].image = 'example/demo:latest';
  unsafe.spec.template.spec.containers[0].resources.requests = {};
  unsafe.spec.template.spec.containers[0].securityContext = { privileged: true };
  unsafe.spec.template.spec.volumes = [{ name: 'host', hostPath: { path: '/tmp' } }];
  const errors = checkManifest('unsafe.yaml', unsafe);
  assert.ok(
    errors.some((error) => error.includes('workload is missing label app.kubernetes.io/component')),
  );
  assert.ok(errors.some((error) => error.includes('selector.matchLabels')));
  assert.ok(errors.some((error) => error.includes('must use a pinned image')));
  assert.ok(errors.some((error) => error.includes('needs resource requests and limits')));
  assert.ok(errors.some((error) => error.includes('privileged containers are prohibited')));
  assert.ok(errors.some((error) => error.includes('hostPath is prohibited')));
});

test('retains kind configuration exemption and rejects malformed API objects', () => {
  assert.deepEqual(
    checkManifest('kind-config.yaml', {
      apiVersion: 'kind.x-k8s.io/v1alpha4',
      kind: 'Cluster',
      nodes: [{ role: 'control-plane' }],
    }),
    [],
  );
  assert.deepEqual(checkManifest('missing.yaml', {}), [
    'missing.yaml: missing apiVersion',
    'missing.yaml: missing kind',
    'missing.yaml: missing metadata.name',
  ]);
});
