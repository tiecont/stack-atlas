#!/usr/bin/env python3
"""Static checks for the Kubernetes lab manifests; optionally ask an API server too."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_ROOT = ROOT / "labs/kubernetes"
WORKLOAD_KINDS = {"Pod", "Deployment", "ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob"}


def pod_template(obj: dict):
    kind = obj.get("kind")
    spec = obj.get("spec", {})
    if kind == "Pod":
        return obj.get("metadata", {}).get("labels", {}), spec
    if kind == "CronJob":
        spec = spec.get("jobTemplate", {}).get("spec", {})
    template = spec.get("template", {})
    return template.get("metadata", {}).get("labels", {}), template.get("spec", {})


def check_manifest(path: Path, obj: dict):
    errors = []
    if obj.get("kind") == "Cluster" and str(obj.get("apiVersion", "")).startswith("kind.x-k8s.io/"):
        return errors
    for field in ("apiVersion", "kind"):
        if not obj.get(field):
            errors.append(f"{path.relative_to(ROOT)}: missing {field}")
    metadata = obj.get("metadata") or {}
    if not metadata.get("name"):
        errors.append(f"{path.relative_to(ROOT)}: missing metadata.name")
    if obj.get("kind") in WORKLOAD_KINDS:
        labels, pod_spec = pod_template(obj)
        for label in ("app.kubernetes.io/name", "app.kubernetes.io/component", "app.kubernetes.io/part-of"):
            if label not in labels:
                errors.append(f"{path.relative_to(ROOT)}: workload is missing label {label}")
        if obj.get("kind") in {"Deployment", "ReplicaSet", "StatefulSet", "DaemonSet"}:
            selector = obj.get("spec", {}).get("selector", {}).get("matchLabels", {})
            if not selector or any(labels.get(key) != value for key, value in selector.items()):
                errors.append(f"{path.relative_to(ROOT)}: selector.matchLabels must match Pod-template labels")
        containers = pod_spec.get("containers", []) + pod_spec.get("initContainers", [])
        if not containers:
            errors.append(f"{path.relative_to(ROOT)}: workload has no containers")
        for container in containers:
            image = container.get("image", "")
            final_component = image.rsplit("/", 1)[-1]
            if not image or final_component.endswith(":latest") or (":" not in final_component and "@sha256:" not in image):
                errors.append(f"{path.relative_to(ROOT)}: container {container.get('name')} must use a pinned image tag or digest")
            resources = container.get("resources", {})
            if not resources.get("requests") or not resources.get("limits"):
                errors.append(f"{path.relative_to(ROOT)}: container {container.get('name')} needs resource requests and limits")
            if container.get("securityContext", {}).get("privileged") is True:
                errors.append(f"{path.relative_to(ROOT)}: privileged containers are prohibited in regular labs")
        volumes = pod_spec.get("volumes", [])
        if any("hostPath" in volume for volume in volumes):
            errors.append(f"{path.relative_to(ROOT)}: hostPath is prohibited in regular labs")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server-side", action="store_true", help="validate each Kubernetes object against the active API server")
    parser.add_argument("--context", default=os.environ.get("CONTEXT", f"kind-{os.environ.get('CLUSTER_NAME', 'stack-atlas')}"), help="kind context used for API-server validation")
    parser.add_argument("--kubectl", default=os.environ.get("KUBECTL", "kubectl"), help="kubectl executable")
    args = parser.parse_args()
    errors = []
    if args.server_side:
        guard = ROOT / "scripts/ci/kubernetes/assert_lab_context.sh"
        guard_env = {**os.environ, "CONTEXT": args.context}
        result = subprocess.run([str(guard)], cwd=ROOT, env=guard_env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
        if result.returncode:
            print(result.stdout.rstrip(), file=sys.stderr)
            return result.returncode
    manifests = sorted(MANIFEST_ROOT.rglob("*.yaml")) + sorted(MANIFEST_ROOT.rglob("*.yml"))
    objects = 0
    for path in manifests:
        try:
            documents = list(yaml.safe_load_all(path.read_text(encoding="utf-8")))
        except (OSError, yaml.YAMLError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
            continue
        for obj in filter(None, documents):
            if not isinstance(obj, dict):
                errors.append(f"{path.relative_to(ROOT)}: each document must be an object")
                continue
            objects += 1
            errors.extend(check_manifest(path, obj))
        if args.server_side and path.name != "kind-config.yaml":
            result = subprocess.run(
                [args.kubectl, "--context", args.context, "apply", "--server-side", "--dry-run=server", "-f", str(path)],
                cwd=ROOT,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=False,
            )
            if result.returncode:
                errors.append(f"{path.relative_to(ROOT)}: API-server dry-run failed:\n{result.stdout.rstrip()}")
    if errors:
        print("Kubernetes manifest validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"Validated {objects} YAML documents across {len(manifests)} Kubernetes lab files.")
    if args.server_side:
        print("All Kubernetes objects passed server-side dry-run validation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
