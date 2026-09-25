# Next.js runtime and API boundary

Stack Atlas Web uses a Next.js App Router runtime for the browser application.
The authored catalog and article bodies remain in the Web repository. The
existing Python builder validates those sources and renders the public content;
Next serves that generated content through its catch-all page route and serves
the account UI as native React pages. This keeps content authoring independent
from account/API work while the public pages move incrementally into Next.

## Local services

| Service | Local address | Owner |
| --- | --- | --- |
| Next.js Web | `http://localhost:3001` | `web` |
| Nest API | `http://localhost:3000/api/v1/` | `api` |
| PostgreSQL | `localhost:5432` | `api/compose.yaml` |
| Go Engine | worker process, no HTTP port | `engine` |

Web rebuilds generated content and copies its assets into ignored `public/`
output before starting Next. Account routes call Nest directly from the browser.
The Engine is not started by Web and is not called by the browser; the current
worker foundation does not yet consume execution jobs.

## Browser API client

`src/lib/api-client.ts` is used by the Next account UI. The legacy static client
in `platform/assets/scripts/api-client.js` follows the same request rules.
Both require an absolute HTTP(S) API base URL, constrain request paths to that
base, send JSON, preserve RFC 9457 Problem Details extensions, and use the HTTP
status as authoritative. Browser requests include credentials so the API's
HttpOnly session cookie works when local Web and API use different ports.

Set `NEXT_PUBLIC_API_BASE_URL` to the API `/api/v1/` base. Nest must list the Web
origin exactly in `CORS_ORIGINS`; local setup uses `http://localhost:3001`.
The API cookie is same-site and `SameSite=Lax`; a cross-site deployment requires
a separate CSRF and cookie-policy decision.

## HTTP integration check

With the API and PostgreSQL running, execute from `web`:

```sh
API_BASE_URL=http://localhost:3000/api/v1/ make test-api-integration
```

The command checks liveness, database readiness, and the Problem Details 404
profile. It fails when `API_BASE_URL` is missing, so a skipped request cannot be
reported as a passing integration run. The check uses Node's HTTP client; it
does not replace a browser check of credentialed CORS behavior.
