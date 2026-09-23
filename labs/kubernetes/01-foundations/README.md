# 01 · Foundations: inspect desired state and reconciliation

This lab uses one Deployment, its controller-created ReplicaSet and two Pods. The demo HTTP process is infrastructure for the exercise; Kubernetes concepts here do not depend on Go.

## Prepare

From this directory, `make apply` starts the shared kind cluster, builds the local image, loads it into kind and applies the namespace, Deployment and Service. All `kubectl` operations explicitly use `--context kind-stack-atlas`, after a guard verifies the context and API. The image uses `imagePullPolicy: Never`; Kubernetes will not try to fetch the lab image from a registry. This `atlas-demo-api:dev` tag is a mutable local image loaded into kind, not an immutable registry reference; remote registry images should use a versioned tag and preferably a digest.

## Explore the API objects

```sh
kubectl --context kind-stack-atlas get deployment,replicaset,pods,service -n atlas-foundations
kubectl --context kind-stack-atlas get deployment atlas-demo-api -n atlas-foundations -o yaml
kubectl --context kind-stack-atlas get pod -n atlas-foundations -l app.kubernetes.io/name=atlas-demo-api -o yaml
kubectl --context kind-stack-atlas explain deployment.spec
kubectl --context kind-stack-atlas get events -n atlas-foundations --sort-by=.metadata.creationTimestamp
```

The API server assigns fields such as UID and resourceVersion. Compare the Deployment selector with the Pod-template labels, then inspect each Pod's owner reference. The Deployment controller owns a ReplicaSet; that ReplicaSet owns the Pods.

## Observe the control loop

```sh
make verify
make break
make verify
```

`make break` deletes one Pod by name. Watch the replacement in another terminal with `kubectl --context kind-stack-atlas get pods -n atlas-foundations -w`. The Deployment does not create the Pod directly: its controller maintains a ReplicaSet, and the ReplicaSet controller restores the requested replica count. The replacement has a new name and UID. A Pod deletion is different from a container restart inside an existing Pod.

For the full scripted smoke test, run `make test`. It checks two available replicas before and after deleting one Pod. `make observe` shows the Deployment, ReplicaSet, Pods, Service, details and namespace events. `make reset` removes only the lab namespace; `make -C ../00-cluster cluster-down` removes the local cluster.

## Failure interpretation

If a replacement remains `Pending`, inspect `kubectl --context kind-stack-atlas describe pod` and namespace events for scheduling constraints. If it is `ImagePullBackOff`, check the image name and whether `kind load docker-image` targeted the same cluster. If it is `CrashLoopBackOff`, inspect `kubectl --context kind-stack-atlas logs` and `kubectl --context kind-stack-atlas logs --previous`. A controller can keep retrying without being able to satisfy the requested state; desired state is an intent, not a guarantee that capacity, images or dependencies exist.
