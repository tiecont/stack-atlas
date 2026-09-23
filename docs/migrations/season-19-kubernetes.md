# Season 19 Kubernetes content audit

The existing 13 Season 19 lesson URLs remain available. Their single canonical bodies live in content/articles/kubernetes/; the old lesson URLs redirect to those articles. The Kubernetes Engineer path references canonical article IDs and does not copy their HTML.

| Season 19 lesson | Current canonical article | Group | Kubernetes Engineer destination | Audit |
| --- | --- | --- | --- | --- |
| Kubernetes Mental Model cho Backend Engineer | /articles/kubernetes/kubernetes-mental-model/ | B | Foundations · Why Kubernetes Exists | Expanded in this slice; retains its stable article ID and URL. |
| Pod và Deployment | /articles/kubernetes/pods-deployments/ | B | Pods and Workloads | Add ownership, ReplicaSet reconciliation, rollout failure experiment and neutral app examples. |
| Service và DNS | /articles/kubernetes/service-discovery/ | B | Networking | Add EndpointSlice, DNS namespace behavior, connection reuse and dataplane implementation caveats. |
| Ingress, Gateway và Edge Routing | /articles/kubernetes/ingress-gateway/ | B | Networking | Separate Ingress from Gateway API; explain CRDs and controller requirement. |
| ConfigMap và Secret | /articles/kubernetes/configmaps-secrets/ | B | Configuration and Storage | Add update semantics, Secret threat model, RBAC and rotation. |
| CPU/Memory Requests và Limits | /articles/kubernetes/requests-limits/ | B | Scheduling and Resources | Expand scheduling/runtime distinctions, QoS, throttling, OOM and metrics. |
| Readiness, Liveness và Startup Probes | /articles/kubernetes/readiness-liveness/ | B | Health and Reliability | Add the ready-but-alive experiment and make dependency failure distinct from process failure. |
| SIGTERM và Graceful Termination | /articles/kubernetes/graceful-termination/ | B | Health and Reliability | Keep the Go code as one implementation example; add language-neutral lifecycle observations. |
| Horizontal Pod Autoscaling | /articles/kubernetes/hpa-autoscaling/ | B | Autoscaling and Capacity | Explain metrics-server prerequisite, controller lag and downstream capacity. |
| PDB và Rolling Update | /articles/kubernetes/pdb-rollout/ | B | Health and Reliability | Separate voluntary disruption from rollout controls; add a bad rollout and rollback. |
| Stateful Workloads và Persistent Storage | /articles/kubernetes/stateful-workloads/ | A | Configuration and Storage | Reuse its central distinction: stable identity/storage do not make a database highly available. Add backup/restore and failure drills as that module is authored. |
| Debug Go Service trên Kubernetes | /articles/kubernetes/kubernetes-debugging/ | C | Observability and Debugging | Keep as a Go-specific case study. When the language-neutral debugging article is authored, turn this page into a short reference to it plus the Go case study. |
| Capstone: Deploy Go API + Worker | /articles/kubernetes/kubernetes-capstone/ | C | Capstones | Keep as a Go-specific implementation example; reference the provider-neutral production backend capstone when that canonical lab exists. |

Group definitions:

- **A — reusable almost unchanged:** keep its existing canonical content and reuse it; expansion can be incremental.
- **B — useful but needs expansion:** retain one canonical article and deepen it in its mapped module.
- **C — reference/case study:** retain the existing URL and useful implementation-specific material; connect it to a broader canonical article when that article exists.

The first path slice contains six Foundations lessons. Only the existing Kubernetes mental-model article is linked into the new path now. Later modules can add the remaining existing article IDs without copying their source bodies. Old Season 19 membership remains in the Golang Backend Engineering path throughout.
