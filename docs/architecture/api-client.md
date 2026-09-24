# Browser API client boundary

Stack Atlas Web remains a generated static site. Its route skeleton comes from
the canonical catalog and renderer; loading the API client does not make page
generation depend on a running API.

`StackAtlasApi.createClient({ baseUrl })` creates an opt-in JSON client. The
caller supplies the API base URL and path, so this layer does not assume that a
learner, account, or progress endpoint exists. Requests advertise JSON and
`application/problem+json`; paths are constrained to the configured base URL.

Errors use RFC 9457 Problem Details. The client exposes the HTTP status and
problem object on `ApiError`, preserves extension members it does not know, and
uses an independent fixture under `tests/fixtures/` so Web tests do not require
the API checkout.

The API currently produces the error format for all HTTP failures. Before a
feature starts calling an API route, its HTTP request/response schema and CORS
origin must be agreed with the API owner and covered by a cross-repository HTTP
integration test.

## Contract handoff

- **Contract:** Stack Atlas Problem Details v1, using RFC 9457
  `application/problem+json`.
- **Producer:** `stack-atlas-api`.
- **Consumer:** `StackAtlasApi` in `stack-atlas-web`.
- **Compatibility:** the API sends `type`, `title`, `status`, and `instance`;
  `detail` is optional. The client keeps unknown extension members and treats
  the HTTP response status as authoritative.
- **Integration test:** with the API running, set `API_BASE_URL` to its `/api/v1/`
  base and run `make test-api-integration`. It checks liveness, PostgreSQL
  readiness, and a 404 response against the local contract fixture. Regular Web
  tests still run with no API checkout or server.
- **Release order:** publish the API error profile first, then the Web client;
  the client stays inert until a Web feature instantiates it against a separately
  agreed route contract.
