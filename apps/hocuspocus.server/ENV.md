# Environment Variables

The authoritative list, types, defaults, and required/optional status live in `src/config/env.schema.ts`. That schema validates `process.env` with Zod at startup and exits the process on any invalid value. This document mirrors that schema. When the two disagree, the schema wins — update it first.

> **Booleans** parse the literal string `'true'`; anything else (including unset) is `false`.
> **Numbers** must match `^\d+$`; otherwise startup fails.
> **Lists** are comma-separated and trimmed; empties are dropped.

## Loading

- **Docker Compose** (`make up-dev`, `make up-prod`): all variables come from the root `.env.development` / `.env.production`. Package-level `.env` files are ignored.
- **Direct dev** (`make dev-backend`, or `bun --filter @docs.plus/hocuspocus dev:rest|dev:ws|dev:worker`): the dev scripts pass `--env-file=../../.env.local`, so variables come from the repo-root `.env.local`. See the root `.env.example` for the full template.

## Required

These have no default and fail startup if missing.

| Variable            | Type   | Notes                                  |
| ------------------- | ------ | -------------------------------------- |
| `DATABASE_URL`      | string | PostgreSQL connection string           |
| `SUPABASE_URL`      | string | Supabase project URL                   |
| `SUPABASE_ANON_KEY` | string | Public anon key (used for health/auth) |

## Core application

| Variable                        | Type                                    | Default                 |
| ------------------------------- | --------------------------------------- | ----------------------- |
| `NODE_ENV`                      | `development` \| `production` \| `test` | `development`           |
| `APP_NAME`                      | string                                  | `hocuspocus`            |
| `APP_PORT`                      | number                                  | `4000` (REST API)       |
| `HOCUSPOCUS_PORT`               | number                                  | `4001` (WebSocket)      |
| `WORKER_HEALTH_PORT`            | number                                  | `4002` (worker health)  |
| `HOCUSPOCUS_INTERNAL_HTTP_PORT` | number                                  | `4003` (internal HTTP)  |
| `HOCUSPOCUS_INTERNAL_HTTP_HOST` | string                                  | `0.0.0.0`               |
| `HOCUSPOCUS_INTERNAL_URL`       | string                                  | `http://localhost:4003` |
| `PUBLIC_RESTAPI_URL`            | string                                  | — (unset)               |

### Public origin

`PUBLIC_RESTAPI_URL` is the origin this REST process itself answers on, e.g. `https://prodback.docs.plus`. Two conversion paths read it. Import re-hosts images out of an uploaded `.docx` and needs it to build a URL the editor can resolve. DOCX export uses it as the allowlist of image origins the converter is allowed to download (see [API.md](./API.md#fidelity-contract)).

- **Origin only — no `/api`**, unlike `SERVER_RESTAPI_URL` (`…:4000/api`) and `NEXT_PUBLIC_RESTAPI_URL` (`…:4000/api`). The route path is appended, so a value set by analogy with those two bakes `…/api/api/plugins/…` permanently into document content.
- **Unset is a supported state, not a broken one — but it costs images in both directions.** Every image in a `.docx` import is reported as a `media-placeholder-dropped` warning and skipped. Every DOCX export comes out with no pictures at all, because an empty allowlist matches nothing. The text survives either way. There is no default and no `X-Forwarded-Host` fallback: the value is persisted into document content, and a client-settable header is not something to persist.
- **Set it to the same origin the stored image URLs carry.** Pad uploads are saved as `NEXT_PUBLIC_RESTAPI_URL` + `/plugins/hypermultimedia/…`. So a `PUBLIC_RESTAPI_URL` pointed at an internal container name, while documents hold the public hostname, makes the export allowlist match nothing.
- Compose passes it through as `${PUBLIC_RESTAPI_URL}` on `rest-api` in both dev and prod. A stale shell export of that name overrides `env_file`. That is what broke worker SMTP. Deploy from a clean shell.

### Internal HTTP listener

The collaboration process serves one internal listener carrying both `/metrics` and the service-role content-apply endpoint. Never expose it through Traefik.

- **`HOCUSPOCUS_INTERNAL_HTTP_PORT`** — moving it off `4003` also requires editing `scripts/observability/prometheus/prometheus.yml` (the scrape target port). The observability job restarts Prometheus after `up -d`. A plain `compose up -d` still ignores mounted-config content.
- **`HOCUSPOCUS_INTERNAL_HTTP_HOST`** — `0.0.0.0` matches the bind this listener has always used. **Do not tighten the default.** Prometheus scrapes the port cross-container by DNS discovery. `infra-target-down` pages when the `hocuspocus-server` scrape target is `up==0`. A loopback default would still kill every collaboration-process metric the moment the Compose env went missing. On a host-run dev machine set `127.0.0.1` yourself. The endpoint mutates documents, and the service-role key shipped in `.env.example` is the world-known Supabase demo JWT, not a secret.
- **`HOCUSPOCUS_INTERNAL_URL`** — where the REST process forwards content applies. Compose sets `http://hocuspocus-server:4003`.

## Security

| Variable                    | Type   | Default                   | Notes                                                                                                                                            |
| --------------------------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | string | —                         | Required for admin routes, internal email endpoints, and server-side Supabase reads. Optional in the schema, but those features fail without it. |
| `ALLOWED_ORIGINS`           | list   | `[]`                      | CORS allowlist. In production, falls back to `[APP_URL]` when empty. Dev allows any origin.                                                      |
| `MCP_AUTH_ISSUER`           | string | `${SUPABASE_URL}/auth/v1` | The OAuth issuer `/api/mcp` names in its metadata. Copy `issuer` from Supabase's `/auth/v1/.well-known/openid-configuration` exactly.            |
| `RATE_LIMIT_MAX`            | number | `100`                     | Requests per 15-minute window (global limiter). Public media reads use a separate bucket at ten times this value, fixed in the middleware        |

## Redis

Redis is optional; features degrade gracefully without it (rate limiting is disabled, Hocuspocus sync/scaling features are unavailable).

| Variable                | Type    | Default     | Notes                                                                                                                             |
| ----------------------- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS`                 | boolean | `false`     |                                                                                                                                   |
| `REDIS_HOST`            | string  | `localhost` | If unset at runtime, `getRedisClient()` returns `null` (Redis disabled)                                                           |
| `REDIS_PORT`            | number  | `6379`      |                                                                                                                                   |
| `REDIS_DB`              | number  | `0`         | Logical Redis database index                                                                                                      |
| `REDIS_TLS`             | boolean | `false`     |                                                                                                                                   |
| `REDIS_CONNECT_TIMEOUT` | number  | `30000`     |                                                                                                                                   |
| `REDIS_COMMAND_TIMEOUT` | number  | `60000`     | Producer-only connections override this with 5s in `lib/queue.ts`; the blocking worker connections set no command timeout at all. |
| `REDIS_KEEPALIVE`       | number  | `30000`     |                                                                                                                                   |
| `REDIS_MAX_RETRIES`     | number  | `10`        |                                                                                                                                   |

## Database pool

Read by `src/lib/prisma.ts` from the validated config only — there are no runtime fallbacks, so the defaults below are the effective values.

| Variable               | Type   | Default  |
| ---------------------- | ------ | -------- |
| `DB_POOL_SIZE`         | number | `10`     |
| `DB_IDLE_TIMEOUT`      | number | `300000` |
| `DB_CONNECT_TIMEOUT`   | number | `10000`  |
| `DB_STATEMENT_TIMEOUT` | number | `60000`  |
| `DB_QUERY_TIMEOUT`     | number | `60000`  |

## Storage

| Variable                       | Type    | Default            | Notes                                                                             |
| ------------------------------ | ------- | ------------------ | --------------------------------------------------------------------------------- |
| `PERSIST_TO_LOCAL_STORAGE`     | boolean | `false`            | `true` uses local disk; otherwise S3-compatible                                   |
| `LOCAL_STORAGE_PATH`           | string  | `./temp`           |                                                                                   |
| `DO_STORAGE_ENDPOINT`          | string  | `''`               | S3-compatible endpoint (DigitalOcean Spaces)                                      |
| `DO_STORAGE_REGION`            | string  | `us-east-1`        |                                                                                   |
| `DO_STORAGE_BUCKET`            | string  | `''`               |                                                                                   |
| `DO_STORAGE_ACCESS_KEY_ID`     | string  | `''`               |                                                                                   |
| `DO_STORAGE_SECRET_ACCESS_KEY` | string  | `''`               |                                                                                   |
| `DO_STORAGE_MAX_FILE_SIZE`     | number  | `10485760` (10 MB) | Max upload size for hypermultimedia (`/api/plugins/hypermultimedia/:documentId`). |

## Email

The provider is an explicit choice. `resolveEmailConfig` (`src/config/email.ts`) reads the variables once at boot. The result is one of three states:

- **`ready`:** `EMAIL_PROVIDER` is `resend` or `smtp`, and every value that provider needs is set. Mail is sent.
- **`off`:** `EMAIL_PROVIDER` is unset, and so are `RESEND_API_KEY`, `SMTP_HOST` and `SENDGRID_API_KEY`. The server boots, and each queued mail settles `skipped` with `email not configured`. Nothing retries.
- **`invalid`:** anything else. The worker starts neither email consumer, so mail waits. It logs `email config invalid` with each problem at error level, at boot and every 5 minutes, and that line pages.

The rules:

- An empty value counts as unset.
- A provider key without `EMAIL_PROVIDER` is `invalid`. A leftover key never picks the sender.
- `EMAIL_FROM` is required. It may be `Name <address>`. There is no fallback address.
- `resend` needs `RESEND_API_KEY`. `smtp` needs `SMTP_HOST`.
- SMTP sign-in is optional. Set both `SMTP_USER` and `SMTP_PASS`, or neither. One without the other is `invalid`.
- `SMTP_SECURE` is `true` or `false`, in any case. When it is empty or unset, the connection is secure only on port 465. Any other value is `invalid`.
- SendGrid is not supported. `EMAIL_PROVIDER=sendgrid` is `invalid`. Use the SendGrid SMTP relay with `EMAIL_PROVIDER=smtp` instead. `SENDGRID_API_KEY` stays in the schema only so that a leftover key reads `invalid`.
- There is no `SMTP_FROM_NAME`. Put a display name in `EMAIL_FROM`.

| Variable                           | Type   | Default             |
| ---------------------------------- | ------ | ------------------- |
| `EMAIL_PROVIDER`                   | string | —                   |
| `EMAIL_FROM`                       | string | —                   |
| `RESEND_API_KEY`                   | string | —                   |
| `SENDGRID_API_KEY`                 | string | —                   |
| `SMTP_HOST`                        | string | `''`                |
| `SMTP_PORT`                        | number | `587`               |
| `SMTP_USER`                        | string | `''`                |
| `SMTP_PASS`                        | string | `''`                |
| `SMTP_SECURE`                      | string | —                   |
| `NEW_DOCUMENT_NOTIFICATION_EMAILS` | list   | `[]`                |
| `APP_URL`                          | string | `https://docs.plus` |
| `EMAIL_UNSUBSCRIBE_SECRET`         | string | `''`                |
| `EMAIL_WORKER_CONCURRENCY`         | number | `3`                 |
| `EMAIL_RATE_LIMIT_MAX`             | number | `50`                |
| `EMAIL_RATE_LIMIT_DURATION`        | number | `60000`             |

Production also needs `EMAIL_UNSUBSCRIBE_SECRET` and `PUBLIC_RESTAPI_URL`. Without the URL, the one-click `List-Unsubscribe` header is dropped. The docs.plus deploy workflows refuse to deploy when any of these four is empty: `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_UNSUBSCRIBE_SECRET` and `PUBLIC_RESTAPI_URL`.

The host of `PUBLIC_RESTAPI_URL`, or else of `APP_URL`, names the provider idempotency keys. Staging and production therefore never share a key.

**Local mail.** The Supabase mail catcher takes SMTP on port 54325 (`smtp_port` in `packages/supabase/config.toml`) and shows the mail at <http://localhost:54324>. It takes no sign-in. Set these lines in `.env.local`, then restart the backend. The blank lines clear any old values from an earlier template.

```
EMAIL_PROVIDER=smtp
EMAIL_FROM=dev@localhost
SMTP_HOST=localhost
SMTP_PORT=54325
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=
```

If Supabase was already running before `smtp_port` was set, restart it.

`APP_URL` loses any trailing `/`, and an empty value falls back to
`https://docs.plus` (`src/config/env.ts`). This one value feeds the production
CORS fallback, MCP document links, and the links in emails and notifications.

`EMAIL_UNSUBSCRIBE_SECRET` signs the one-click unsubscribe links in every footer
(`lib/unsubscribeToken.ts`). The token is the whole credential, so a link works
with no session. Generate one with `openssl rand -base64 48`. Use a different
value per environment.

Unset does not mean the mail ships without a link. `getUnsubscribeLinks` logs at
error and returns nothing, and `helpers.ts` then falls back to
`${APP_URL}/unsubscribe` with no token. The route rejects that link and tells the
reader it is invalid. The RFC 8058 `List-Unsubscribe` header is omitted, which is
correct: a header that answers 200 without writing is worse than none.

`PUBLIC_RESTAPI_URL` must also reach the email worker. The header URL is built
from it, because a mail client posts the URL itself and runs no JavaScript.

## Push notifications (VAPID)

| Variable                   | Type   | Default                    |
| -------------------------- | ------ | -------------------------- |
| `VAPID_PUBLIC_KEY`         | string | `''`                       |
| `VAPID_PRIVATE_KEY`        | string | `''`                       |
| `VAPID_SUBJECT`            | string | `mailto:support@docs.plus` |
| `PUSH_WORKER_CONCURRENCY`  | number | `5`                        |
| `PUSH_RATE_LIMIT_MAX`      | number | `100`                      |
| `PUSH_RATE_LIMIT_DURATION` | number | `60000`                    |

## BullMQ

| Variable                     | Type   | Default |
| ---------------------------- | ------ | ------- |
| `BULLMQ_CONCURRENCY`         | number | `5`     |
| `BULLMQ_RATE_LIMIT_MAX`      | number | `300`   |
| `BULLMQ_RATE_LIMIT_DURATION` | number | `1000`  |

## Worker

| Variable                          | Type   | Default   | Notes                                                                                                                                                                                                                                                           |
| --------------------------------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WORKER_ERROR_THRESHOLD`          | number | `10`      |                                                                                                                                                                                                                                                                 |
| `WORKER_ERROR_WINDOW_MS`          | number | `60000`   |                                                                                                                                                                                                                                                                 |
| `WORKER_SHUTDOWN_TIMEOUT_MS`      | number | `120000`  |                                                                                                                                                                                                                                                                 |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | number | `3600000` |                                                                                                                                                                                                                                                                 |
| `DOC_AUTOSAVE_RETENTION_DAYS`     | number | `30`      | The hourly cleanup thins autosave version rows older than this to one per document per day. A name a person typed (`checkpoint`, `api`, `revert`) and pre-column `trigger = null` rows are exempt forever; machine triggers are not. `0` disables the thinning. |
| `DOC_DELETE_RETENTION_DAYS`       | number | `30`      | The hourly reaper purges the footprint of documents soft-deleted longer ago than this. `0` disables the reaper.                                                                                                                                                 |

## Hocuspocus logger

All boolean, default `false`. Enable per-event logging on the WebSocket server.

`HOCUSPOCUS_LOGGER`, `HOCUSPOCUS_LOGGER_ON_CONNECT`, `HOCUSPOCUS_LOGGER_ON_DISCONNECT`, `HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT`, `HOCUSPOCUS_LOGGER_ON_CHANGE`, `HOCUSPOCUS_LOGGER_ON_UPGRADE`, `HOCUSPOCUS_LOGGER_ON_REQUEST`, `HOCUSPOCUS_LOGGER_ON_LISTEN`, `HOCUSPOCUS_LOGGER_ON_DESTROY`, `HOCUSPOCUS_LOGGER_ON_CONFIGURE`.

## Hocuspocus throttle

| Variable                       | Type    | Default |
| ------------------------------ | ------- | ------- |
| `HOCUSPOCUS_THROTTLE`          | boolean | `false` |
| `HOCUSPOCUS_THROTTLE_ATTEMPTS` | number  | `10`    |
| `HOCUSPOCUS_THROTTLE_BANTIME`  | number  | `1`     |

`HOCUSPOCUS_THROTTLE_BANTIME` is in **minutes**: `@hocuspocus/extension-throttle` multiplies it by 60 × 1000, so `60000` bans an IP for about 41.7 days. Keep it small. `.env.production` on the server is source of truth and can override this — verify the running value with `docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec hocuspocus-server env | grep BANTIME`.

## Logging

| Variable    | Type                                                                     | Default |
| ----------- | ------------------------------------------------------------------------ | ------- |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info`  |
