# Next.js runtime and API boundary

Stack Atlas Web uses Next.js App Router for public content and account pages.
Public article documents and account data come from the Nest API; supplemental
topic/path catalog data remains local during the current migration phase. Web
does not call Engine.

## Local services

| Service     | Local address                   | Owner              |
| ----------- | ------------------------------- | ------------------ |
| Next.js Web | `http://localhost:3001`         | `web`              |
| Nest API    | `http://localhost:3000/api/v1/` | `api`              |
| PostgreSQL  | `localhost:5432`                | `api/compose.yaml` |
| Go Engine   | worker process, no HTTP port    | `engine`           |

Public article routes load published Content API data in Server Components.
Search uses the Web Route Handler to combine API-published article results with
the current Git-backed topic/path results. Account routes call Nest from the
browser. The Engine is not started by Web and is not called by the browser.

## Browser API client

`lib/api/client.ts` is the only API client used by the account UI. It requires
an absolute HTTP(S) API base URL, constrains request paths to that base, sends
JSON, preserves RFC 9457 Problem Details extensions, and uses the HTTP status
as authoritative. Browser requests include credentials so the API's HttpOnly
session cookie works when local Web and API use different ports.

Set `NEXT_PUBLIC_API_BASE_URL` to the API `/api/v1/` base. Nest must list the Web
origin exactly in `CORS_ORIGINS`; local setup uses `http://localhost:3001`.
Cross-site deployment needs compatible credentialed CORS and cookie policy.

Server-side public content reads use the same client with a 60-second Next.js
Data Cache revalidation and a 3.5-second timeout. Published article 404s remain
404s; upstream failures render a generic 500 error state. The Web never falls
back to the old filesystem article body.

## HTTP integration check

With the API and PostgreSQL running, execute from `web`:

```sh
API_BASE_URL=http://localhost:3000/api/v1/ make test-api-integration
```

The command checks liveness, database readiness, and the Problem Details 404
profile. It fails when `API_BASE_URL` is missing. It does not replace a browser
check of credentialed CORS behavior.
