# Parallel development plan

This workspace contains three separately owned repositories. Each repository
must build from its own checkout and must not import source code from a sibling.

## Work lanes

### Web

- Own Next.js pages, browser behavior, and authored learning content.
- Use the Nest API over versioned HTTP contracts for account and learner state.
- Never call the Go Engine from the browser.
- Develop public content without API or Engine checkouts; API-backed pages need
  only the API and its PostgreSQL database.

### API

- Own identity, learning state, submissions, persistence, and API authorization.
- Develop and verify business behavior without a live Engine.
- Keep the HTTP contract and any future execution event fixture in API docs and
  tests so Engine work does not depend on the API checkout.

### Engine

- Own job consumption, runner selection, sandbox lifecycle, execution, and
  normalized result publication.
- Develop runner behavior and transport adapters without Web or API checkouts.
- Never own accounts or learning progress.

## Current integration boundaries

- **Web → API:** Identity v1 uses JSON and an HttpOnly session cookie. The local
  Web origin is `http://localhost:3001`; API CORS and origin checks allow that
  exact origin. Web sends credentialed requests to API port `3000`.
- **API → PostgreSQL:** API Compose provides a disposable local PostgreSQL 16
  service on port `5432`.
- **API → Engine:** this is not wired yet. API submission/outbox publishing,
  shared `execution.requested.v1` and `execution.result.v1` fixtures, Engine
  codecs, and worker composition remain a separate execution integration lane.
  The current Engine worker is safe to develop independently, but starting it
  does not execute API submissions.

## Local startup

1. In `api`, copy `.env.example` to `.env`, run `docker compose up -d --wait postgres`,
   apply migrations, and start `npm run start:dev` on port `3000`.
2. In `web`, copy `.env.local.example` to `.env.local` and run `npm run dev` on
   port `3001`. Public content works without API; account routes need API and
   PostgreSQL.
3. In `engine`, run `make run` when working on the worker. It does not need the
   other repositories.

The Web-to-API HTTP contract check from `web` is:

```sh
API_BASE_URL=http://localhost:3000/api/v1/ make test-api-integration
```

That command requires a running API and database and fails when `API_BASE_URL`
is missing.

## Integration gates for future execution work

1. API and Engine owners agree on immutable versioned request/result envelopes
   and commit matching independent fixtures in both repositories.
2. Engine codecs validate those fixtures and runner tests work without Kafka or
   API infrastructure.
3. API writes submissions and outbox records transactionally; API integration
   tests use a fake result consumer.
4. A cross-repository test starts PostgreSQL and Kafka, submits a job through
   API, and verifies idempotent result application. This gate is not met by the
   current foundation code.
