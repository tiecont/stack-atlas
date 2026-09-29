# Lab runtime ownership

Web presents learning content, lab guides and explicitly registered project
files. It does not create Kubernetes namespaces, run `kubectl` for learners,
own sandbox lifecycle, or store lab session state.

Engine executes future remote labs. Remote execution and session ownership
belong to Engine; Web remains the learning interface and calls the configured
API only through its existing Web-to-API boundary.

The Kubernetes lab in this repository is a local learning asset. Its manifest
validation, context safety checks, Go demo tests and kind smoke test run in the
separate Kubernetes workflow, outside the production Web runtime.
