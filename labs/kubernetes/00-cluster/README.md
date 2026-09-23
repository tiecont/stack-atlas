# 00 · Local kind cluster

This shared lab creates a disposable three-node Kubernetes v1.37.0 cluster. Each node image is pinned to the digest published by kind v0.33.0. kind runs the nodes as containers; it is a learning environment, not a production cluster or a simulation of a cloud provider's managed control plane.

## Requirements

- Docker Engine that is running and accessible to your user.
- kind v0.33.0.
- kubectl v1.37.0 (the same minor as the cluster).
- At least 4 CPU cores and 6 GiB RAM available to Docker; the two workers make scheduling and ownership experiments visible.

On Linux, install kind from the pinned upstream release and install kubectl from the Kubernetes v1.37.0 release. On other platforms, use the matching upstream binary for your architecture. See the official [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/) and [kubectl install instructions](https://kubernetes.io/docs/tasks/tools/).

## Commands

```sh
make doctor
make cluster-up
make cluster-info
make cluster-down
```

`cluster-up` uses context `kind-stack-atlas` and leaves an existing cluster with that name in place. `cluster-down` deletes only this named kind cluster. It does not modify other kubeconfig contexts or clusters.

The default kind CNI is sufficient for the foundations lab. Later NetworkPolicy lessons must install and pin a policy-enforcing CNI explicitly; creating a NetworkPolicy object alone does not guarantee enforcement.
