# atlas-demo-api

A dependency-free HTTP process used as test equipment in the Kubernetes labs. The Kubernetes lessons do not require the learner to understand or modify Go code.

The service listens on `:8080` by default and provides:

- `GET /health/live` and `GET /health/ready` for separate liveness and readiness signals.
- `POST /toggle-ready` to make readiness fail or recover during a lab.
- `GET /version` to identify the running image version.
- `GET /work?ms=100` for bounded CPU work (maximum 5 seconds).
- `GET /memory?mb=16` to touch a bounded allocation (maximum 256 MiB); use only in the isolated resource-limit lab.
- `GET /dependencies` to report dependency names supplied through `DEPENDENCY_NAMES`.

On `SIGTERM`, the process marks itself unready, waits two seconds for endpoint changes to propagate, then asks `net/http` to drain active requests for up to 15 seconds. The delay is a teaching aid, not a guarantee about every cluster's endpoint or load-balancer propagation time.

Run `make test`, `make run`, or build the non-root scratch image with `make image`. The image tag is deliberately fixed to `atlas-demo-api:dev` for local kind labs and is never published as a production image.
