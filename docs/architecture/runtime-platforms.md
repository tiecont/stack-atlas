# Runtime platforms

Stack Atlas Web builds one Next.js standalone artifact for a source revision.
The same immutable Docker image runs as either the learner or admin surface;
infrastructure supplies `STACK_ATLAS_WEB_PLATFORM` and maps the desired host to
that runtime. Web does not select a surface from the request hostname.

## Configuration and startup

`lib/platform/config.ts` is the only reader of `STACK_ATLAS_WEB_PLATFORM`.
Production accepts `learner` or `admin` and fails during Next server
initialization if the value is missing or invalid. Development may omit it and
defaults to learner. The platform setting is runtime configuration and is not
a build argument baked into the client bundle.

CI builds the production image once, then starts that same image with both
platform values. The runner image has no platform default. Local Compose sets a
learner default for convenience; deployment infrastructure must choose its
runtime value explicitly.

## Route ownership

The Next.js `proxy.ts` gate applies ownership checks before route rendering.
Rejected routes respond with 404. The root on admin redirects to `/admin/`.

| Surface | Routes                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Learner | `/`, `/articles/*`, `/topics/*`, `/paths/*`, `/search`, `/labs/*`, `/examples/*`, `/about`, `/sitemap.xml`, `/robots.txt` |
| Admin   | `/admin/*`; `/` redirects here                                                                                            |
| Shared  | `/_next/*`, explicit public assets (`/favicon.ico`, `/icon.svg`), `/api/healthz`, `/login`, `/register`, `/account/*`     |

Auth screens are shared so users can use the existing Account session API from
either runtime. Learner route ownership otherwise remains on learner mode;
admin mode returns 404 for learner pages and search APIs. The health route
reports only that the Web process responds and does not call the API.

## Authentication and authorization

Platform mode selects which product surface is served. It is not a user role,
identity check, or authorization decision. Login, registration, and account
operations continue through the canonical client in `lib/api/client.ts`.
Future authoring reads and writes must be checked against API permissions on
the server for every request. Hiding a link or rendering the admin shell does
not grant permission. The current admin routes contain no authoring actions or
content metrics.

## Content ownership boundary

Git-authored content remains canonical for learner pages in this phase. Web
does not dual-write the catalog or read published content from API/PostgreSQL.
Admin content shows an explicit empty/coming-next state until API authoring
endpoints exist. A later sequence adds API authoring, a dynamic editor, and an
explicit Git-to-API cutover.
