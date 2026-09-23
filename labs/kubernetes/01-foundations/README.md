# 01 · Foundations: inspect desired state and reconciliation

This lab uses one Deployment, its controller-created ReplicaSet and two Pods. The demo HTTP process is infrastructure for the exercise; Kubernetes concepts here do not depend on Go.

## Prepare

From this directory, `make apply` starts the shared kind cluster, builds the local image, loads it into kind and applies the namespace, Deployment and Service. The image uses `imagePullPolicy: Never`; Kubernetes will not try to fetch the lab image from a registry.

## Explore the API objects

```sh
kubectl get deployment,replicaset,pods,service -n atlas-foundations
kubectl get deployment atlas-demo-api -n atlas-foundations -o yaml
kubectl get pod -n atlas-foundations -l app.kubernetes.io/name=atlas-demo-api -o yaml
kubectl explain deployment.spec
kubectl get events -n atlas-foundations --sort-by=.metadata.creationTimestamp
```

The API server assigns fields such as UID and resourceVersion. Compare the Deployment selector with the Pod-template labels, then inspect each Pod's owner reference. The Deployment controller owns a ReplicaSet; that ReplicaSet owns the Pods.

## Observe the control loop

```sh
make verify
make break
make verify
```

`make break` deletes one Pod by name. Watch the replacement in another terminal with `kubectl get pods -n atlas-foundations -w`. The Deployment does not create the Pod directly: its controller maintains a ReplicaSet, and the ReplicaSet controller restores the requested replica count. The replacement has a new name and UID. A Pod deletion is different from a container restart inside an existing Pod.

For the full scripted smoke test, run `make test`. It checks two available replicas before and after deleting one Pod. `make observe` shows the Deployment, ReplicaSet, Pods, Service, details and namespace events. `make reset` removes only the lab namespace; `make -C ../00-cluster cluster-down` removes the local cluster.

## Failure interpretation

If a replacement remains `Pending`, inspect `kubectl describe pod` and namespace events for scheduling constraints. If it is `ImagePullBackOff`, check the image name and whether `kind load docker-image` targeted the same cluster. If it is `CrashLoopBackOff`, inspect `kubectl logs` and `kubectl logs --previous`. A controller can keep retrying without being able to satisfy the requested state; desired state is an intent, not a guarantee that capacity, images or dependencies exist.
