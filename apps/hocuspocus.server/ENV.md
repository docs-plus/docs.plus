# Environment Variables

This page covers the environment variables of the backend: the REST API, the collaboration server and the worker. It mirrors `src/config/env.schema.ts`, plus the names in [Read outside the schema](#read-outside-the-schema). The schema validates `process.env` with Zod at startup, and the process exits on any invalid value. When this page and the schema disagree, the schema wins. Update the schema first.

> **Booleans** parse the literal string `'true'`; anything else (including unset) is `false`.
> **Numbers** must match `^\d+$`; otherwise startup fails.
> **Lists** are comma-separated and trimmed; empties are dropped.

## Loading

- **Production Compose** (`make up-prod`, `docker-compose.prod.yml`): each backend service loads the root `.env.production` through `env_file:`. Compose also reads that file through `--env-file .env.production` to fill each `${NAME}` in the compose file. Keys under `environment:` win over the env file, as the tables below show. Package-level `.env` files are ignored.
- **Development Compose** (`make up-dev`, `docker-compose.dev.yml`): this compose file has no `env_file:`. A key reaches a container only when the compose file lists it under `environment:`. Its value comes from your shell or from `--env-file .env.development`.
- **Direct dev** (`make dev-backend`, or `bun --filter @docs.plus/hocuspocus dev:rest|dev:ws|dev:worker`): the dev scripts pass `--env-file=../../.env.local`, so variables come from the repo-root `.env.local`. See the root `.env.example` for the full template.

### Keys that production Compose sets

`docker-compose.prod.yml` sets some keys under `environment:`. Those values win over the env file. A value in your shell also wins over `--env-file`. A changed value lands only when you recreate the containers, as [Configuration](../../docs/self-hosting/configuration.md#recreate-or-the-change-does-not-land) says.

Fixed in Compose. The env file cannot change these keys.

| Variable                        | Value                           | Services                   |
| ------------------------------- | ------------------------------- | -------------------------- |
| `NODE_ENV`                      | `production`                    | all three backend services |
| `RUN_MIGRATIONS`                | `0`                             | all three backend services |
| `REDIS_HOST`                    | `docsplus-redis`                | all three backend services |
| `REDIS_PORT`                    | `6379`                          | all three backend services |
| `DB_IDLE_TIMEOUT`               | `30000`                         | all three backend services |
| `SENTRY_ROLE`                   | the service name                | all three backend services |
| `APP_PORT`                      | `4000`                          | `rest-api`                 |
| `HOCUSPOCUS_INTERNAL_URL`       | `http://hocuspocus-server:4003` | `rest-api`                 |
| `HOCUSPOCUS_PORT`               | `4001`                          | `hocuspocus-server`        |
| `HOCUSPOCUS_INTERNAL_HTTP_HOST` | `0.0.0.0`                       | `hocuspocus-server`        |
| `HOCUSPOCUS_LOGGER`             | `false`                         | `hocuspocus-server`        |
| `HOCUSPOCUS_THROTTLE`           | `true`                          | `hocuspocus-server`        |
| `WORKER_HEALTH_PORT`            | `4002`                          | `hocuspocus-worker`        |
| `WORKER_SHUTDOWN_TIMEOUT_MS`    | `120000`                        | `hocuspocus-worker`        |

Read from the env file, with a Compose default. Editing these keys in `.env.production` works. The default applies when the key is unset or empty.

| Variable                   | Compose default             | Services                        |
| -------------------------- | --------------------------- | ------------------------------- |
| `DB_POOL_SIZE`             | `5`                         | `rest-api`, `hocuspocus-server` |
| `LOG_LEVEL`                | `info`                      | all three backend services      |
| `REST_LOG_LEVEL`           | `info`                      | `rest-api`                      |
| `GIT_HASH`                 | `DEPLOY_TAG`, or else empty | all three backend services      |
| `DO_STORAGE_MAX_FILE_SIZE` | `10485760`                  | `rest-api`, `hocuspocus-server` |
| `VAPID_SUBJECT`            | `mailto:support@docs.plus`  | `hocuspocus-worker`             |

On `hocuspocus-worker` only, `DB_POOL_SIZE` and `BULLMQ_CONCURRENCY` both take `WORKER_DB_POOL_SIZE` (default `10`). So `DB_POOL_SIZE` and `BULLMQ_CONCURRENCY` in the env file do nothing on the worker. Set `WORKER_DB_POOL_SIZE` instead.

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

`PUBLIC_RESTAPI_URL` is the origin this REST process itself answers on, e.g. `https://prodback.docs.plus`. These features read it:

- **DOCX import** re-hosts images out of an uploaded `.docx`. It needs the value to build a URL the editor can resolve.
- **DOCX export** uses it as the allowlist of image origins the converter may download (see [API.md](./API.md#fidelity-contract)).
- **The MCP connector** builds its resource URL from it. When it is unset, the connector uses the origin of the request.
- **The email `List-Unsubscribe` header** is built from it. See [Email](#email).

Rules for the value:

- **Origin only — no `/api`**, unlike `SERVER_RESTAPI_URL` (`…:4000/api`) and `NEXT_PUBLIC_RESTAPI_URL` (`…:4000/api`). The route path is appended, so a value set by analogy with those two bakes `…/api/api/plugins/…` permanently into document content.
- **Unset is a supported state, not a broken one — but it costs images in both directions.** Every image in a `.docx` import is reported as a `media-placeholder-dropped` warning and skipped. Every DOCX export comes out with no pictures at all, because an empty allowlist matches nothing. The text survives either way. The two DOCX paths have no default and no `X-Forwarded-Host` fallback: the value is persisted into document content, and a client-settable header is not something to persist.
- **Set it to the same origin the stored image URLs carry.** Pad uploads are saved as `NEXT_PUBLIC_RESTAPI_URL` + `/plugins/hypermultimedia/…`. So a `PUBLIC_RESTAPI_URL` pointed at an internal container name, while documents hold the public hostname, makes the export allowlist match nothing.
- Compose passes it through as `${PUBLIC_RESTAPI_URL}` on `rest-api` in both dev and prod, and on `hocuspocus-worker` in prod. A stale shell export of that name overrides `env_file`. That is what broke worker SMTP. Deploy from a clean shell.

### Internal HTTP listener

The collaboration process serves one internal listener carrying both `/metrics` and the service-role content-apply endpoint. Never expose it through Traefik.

- **`HOCUSPOCUS_INTERNAL_HTTP_PORT`** — moving it off `4003` also requires editing `scripts/observability/prometheus/prometheus.yml` (the scrape target port). The observability job restarts Prometheus after `up -d`. A plain `compose up -d` still ignores mounted-config content.
- **`HOCUSPOCUS_INTERNAL_HTTP_HOST`** — `0.0.0.0` matches the bind this listener has always used. **Do not tighten the default.** Prometheus scrapes the port cross-container by DNS discovery. `infra-target-down` pages when the `hocuspocus-server` scrape target is `up==0`. A loopback default would still kill every collaboration-process metric the moment the Compose env went missing. On a host-run dev machine set `127.0.0.1` yourself. The endpoint mutates documents, and the service-role key shipped in `.env.example` is the world-known Supabase demo JWT, not a secret.
- **`HOCUSPOCUS_INTERNAL_URL`** — where the REST process forwards content applies. Compose sets `http://hocuspocus-server:4003`.

## Security

| Variable                    | Type   | Default                   | Notes                                                                                                                                                                                                         |
| --------------------------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | string | —                         | Required for admin routes, internal email endpoints, and server-side Supabase reads. Optional in the schema, but those features fail without it.                                                              |
| `ALLOWED_ORIGINS`           | list   | `[]`                      | CORS allowlist. Empty falls back to `[APP_URL]`. With `NODE_ENV=development`, CORS lets any origin pass. See the notes below.                                                                                 |
| `MCP_AUTH_ISSUER`           | string | `${SUPABASE_URL}/auth/v1` | The OAuth issuer `/api/mcp` names in its metadata. Copy `issuer` from Supabase's `/auth/v1/.well-known/openid-configuration` exactly.                                                                         |
| `RATE_LIMIT_MAX`            | number | `100`                     | Requests per 15-minute window (global limiter). Public media reads use a separate bucket at ten times this value, fixed in the middleware. An `/api/mcp` call with an accepted OAuth token does not spend it. |

- **`ALLOWED_ORIGINS` lists both browser apps.** In production, set it to `https://<APP_HOST>,https://<ADMIN_HOST>`. The editor and the admin dashboard both call `https://<API_HOST>` from the browser.
- **Each entry must equal the browser's `Origin` header.** Write the scheme and the host, plus a port only when it is not the default. Add no path and no trailing slash. The server trims spaces and changes nothing else.
- **Do not keep the template value.** `.env.example` lists `http://localhost:3000,http://localhost:3001`. Any non-empty list turns off the fallback, so that value blocks both apps in production.
- **The fallback covers only the editor.** An empty list admits `APP_URL` alone, and `APP_URL` defaults to `https://docs.plus`. The browser then blocks every admin dashboard call to the API.
- **The same list gates `/api/mcp`.** A request whose `Origin` header is not in the list gets `403`, in any `NODE_ENV`.

`<APP_HOST>`, `<API_HOST>` and `<ADMIN_HOST>` are the hosts that [Install, step 4](../../docs/self-hosting/install.md#4-point-your-domains-at-the-server) names.

## Redis

Redis is optional; features degrade gracefully without it (rate limiting is disabled, Hocuspocus sync/scaling features are unavailable). A deploy with more than one collaboration replica still needs it; see the `REDIS` row.

| Variable                | Type    | Default     | Notes                                                                                                                                           |
| ----------------------- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS`                 | boolean | `false`     | Must be `true` on any deploy with more than one collaboration replica. The shipped prod compose runs two. Without it, the replicas do not sync. |
| `REDIS_HOST`            | string  | `localhost` | If unset at runtime, `getRedisClient()` returns `null` (Redis disabled)                                                                         |
| `REDIS_PORT`            | number  | `6379`      |                                                                                                                                                 |
| `REDIS_DB`              | number  | `0`         | Logical Redis database index                                                                                                                    |
| `REDIS_PASSWORD`        | string  | —           | Sent by every Redis client. Set it when Redis runs with `--requirepass`.                                                                        |
| `REDIS_TLS`             | boolean | `false`     |                                                                                                                                                 |
| `REDIS_CONNECT_TIMEOUT` | number  | `30000`     |                                                                                                                                                 |
| `REDIS_COMMAND_TIMEOUT` | number  | `60000`     | Producer-only connections override this with 5s in `lib/queue.ts`; the blocking worker connections set no command timeout at all.               |
| `REDIS_KEEPALIVE`       | number  | `30000`     |                                                                                                                                                 |
| `REDIS_MAX_RETRIES`     | number  | `10`        |                                                                                                                                                 |

## Database pool

Read by `src/lib/prisma.ts` from the validated config only. There are no runtime fallbacks. The schema defaults apply only where Compose does not set the key. See [Loading](#loading).

| Variable               | Type   | Default  |
| ---------------------- | ------ | -------- |
| `DB_POOL_SIZE`         | number | `10`     |
| `DB_IDLE_TIMEOUT`      | number | `300000` |
| `DB_CONNECT_TIMEOUT`   | number | `10000`  |
| `DB_STATEMENT_TIMEOUT` | number | `60000`  |
| `DB_QUERY_TIMEOUT`     | number | `60000`  |
| `WORKER_DB_POOL_SIZE`  | number | `10`     |

`WORKER_DB_POOL_SIZE` is read by `docker-compose.prod.yml`, not by the schema. On the worker it sets both `DB_POOL_SIZE` and `BULLMQ_CONCURRENCY`. Concurrency then matches the pool, so jobs do not wait for a connection.

## Storage

| Variable                       | Type    | Default                  | Notes                                                                             |
| ------------------------------ | ------- | ------------------------ | --------------------------------------------------------------------------------- |
| `PERSIST_TO_LOCAL_STORAGE`     | boolean | `false`                  | `true` uses local disk; otherwise S3-compatible                                   |
| `LOCAL_STORAGE_PATH`           | string  | `./temp/hypermultimedia` | The local adapter reads `process.env` directly, so the schema value is not used.  |
| `DO_STORAGE_ENDPOINT`          | string  | `''`                     | S3-compatible endpoint (DigitalOcean Spaces)                                      |
| `DO_STORAGE_REGION`            | string  | `us-east-1`              |                                                                                   |
| `DO_STORAGE_BUCKET`            | string  | `''`                     |                                                                                   |
| `DO_STORAGE_ACCESS_KEY_ID`     | string  | `''`                     |                                                                                   |
| `DO_STORAGE_SECRET_ACCESS_KEY` | string  | `''`                     |                                                                                   |
| `DO_STORAGE_MAX_FILE_SIZE`     | number  | `10485760` (10 MB)       | Max upload size for hypermultimedia (`/api/plugins/hypermultimedia/:documentId`). |

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
| `RESEND_WEBHOOK_SECRET`            | string | —                   |
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

`RESEND_WEBHOOK_SECRET` is optional. It is the `whsec_` signing secret of the Resend webhook endpoint. When it is set and valid, REST mounts `POST /api/email/webhooks/resend`, which records bounces and complaints ([API.md](./API.md#post-apiemailwebhooksresend)). When it is unset, that path answers 404. A value that is not base64, or decodes to under 24 bytes, counts as unset. REST then logs `email webhook secret invalid` at error level. Product mail never waits for this secret, and no deploy check reads it.

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

On the worker, production Compose sets `BULLMQ_CONCURRENCY` from `WORKER_DB_POOL_SIZE`; see [Loading](#loading).

## Worker

| Variable                          | Type   | Default   | Notes                                                                                                                                                                                                                                                           |
| --------------------------------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WORKER_ERROR_THRESHOLD`          | number | `10`      |                                                                                                                                                                                                                                                                 |
| `WORKER_ERROR_WINDOW_MS`          | number | `60000`   |                                                                                                                                                                                                                                                                 |
| `WORKER_SHUTDOWN_TIMEOUT_MS`      | number | `120000`  | Production Compose fixes it to `120000`; see [Loading](#loading).                                                                                                                                                                                               |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | number | `3600000` |                                                                                                                                                                                                                                                                 |
| `DOC_AUTOSAVE_RETENTION_DAYS`     | number | `30`      | The hourly cleanup thins autosave version rows older than this to one per document per day. A name a person typed (`checkpoint`, `api`, `revert`) and pre-column `trigger = null` rows are exempt forever; machine triggers are not. `0` disables the thinning. |
| `DOC_DELETE_RETENTION_DAYS`       | number | `30`      | The hourly reaper purges the footprint of documents soft-deleted longer ago than this. `0` disables the reaper.                                                                                                                                                 |

## Hocuspocus logger

All boolean, default `false`. Enable per-event logging on the WebSocket server. Production Compose fixes `HOCUSPOCUS_LOGGER` to `false`; see [Loading](#loading).

`HOCUSPOCUS_LOGGER`, `HOCUSPOCUS_LOGGER_ON_CONNECT`, `HOCUSPOCUS_LOGGER_ON_DISCONNECT`, `HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT`, `HOCUSPOCUS_LOGGER_ON_CHANGE`, `HOCUSPOCUS_LOGGER_ON_UPGRADE`, `HOCUSPOCUS_LOGGER_ON_REQUEST`, `HOCUSPOCUS_LOGGER_ON_LISTEN`, `HOCUSPOCUS_LOGGER_ON_DESTROY`, `HOCUSPOCUS_LOGGER_ON_CONFIGURE`.

## Hocuspocus throttle

| Variable                       | Type    | Default |
| ------------------------------ | ------- | ------- |
| `HOCUSPOCUS_THROTTLE`          | boolean | `false` |
| `HOCUSPOCUS_THROTTLE_ATTEMPTS` | number  | `10`    |
| `HOCUSPOCUS_THROTTLE_BANTIME`  | number  | `1`     |

Production Compose fixes `HOCUSPOCUS_THROTTLE` to `true`; see [Loading](#loading).

`HOCUSPOCUS_THROTTLE_BANTIME` is in **minutes**: `@hocuspocus/extension-throttle` multiplies it by 60 × 1000, so `60000` bans an IP for about 41.7 days. Keep it small. `.env.production` on the server is source of truth and can override this — verify the running value with `docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production exec hocuspocus-server env | grep BANTIME`.

## Logging

| Variable    | Type                                                                     | Default                                      |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info` in production, `debug` in development |

The logger reads `LOG_LEVEL` itself (`src/lib/logger.ts`). When it is unset, the level is `debug` if `NODE_ENV` is `development`, and `info` otherwise. The schema still validates the value, so a value outside the list fails startup. Per-service levels are in [Read outside the schema](#read-outside-the-schema).

## Read outside the schema

The backend code or its container entrypoint reads these names directly. The schema does not validate them.

### Per-service log levels

`src/lib/logger.ts` gives each module its own level. A value outside the `LOG_LEVEL` list is ignored, and the fallback applies. Startup does not fail.

| Variable                         | Fallback    |
| -------------------------------- | ----------- |
| `HTTP_LOG_LEVEL`                 | `LOG_LEVEL` |
| `DB_LOG_LEVEL`                   | `LOG_LEVEL` |
| `REDIS_LOG_LEVEL`                | `error`     |
| `QUEUE_LOG_LEVEL`                | `LOG_LEVEL` |
| `REST_LOG_LEVEL`                 | `error`     |
| `WS_LOG_LEVEL`                   | `LOG_LEVEL` |
| `WORKER_LOG_LEVEL`               | `LOG_LEVEL` |
| `DOCUMENTS_CONTROLLER_LOG_LEVEL` | `LOG_LEVEL` |
| `DOCUMENTS_SERVICE_LOG_LEVEL`    | `LOG_LEVEL` |
| `MEDIA_SERVICE_LOG_LEVEL`        | `LOG_LEVEL` |
| `CONVERSION_LOG_LEVEL`           | `LOG_LEVEL` |
| `STORAGE_LOCAL_LOG_LEVEL`        | `LOG_LEVEL` |
| `STORAGE_S3_LOG_LEVEL`           | `LOG_LEVEL` |
| `JWT_LOG_LEVEL`                  | `LOG_LEVEL` |
| `EMAIL_LOG_LEVEL`                | `LOG_LEVEL` |
| `PUSH_LOG_LEVEL`                 | `LOG_LEVEL` |
| `ADMIN_LOG_LEVEL`                | `LOG_LEVEL` |

`LOG_LEVEL` in this table means the resolved base level, with its own default. Production Compose sets `REST_LOG_LEVEL` to `info` when the env file leaves it unset; see [Loading](#loading). So the `error` fallback for `REST_LOG_LEVEL` applies only outside that compose file.

### Error reporting and startup

| Variable                  | Read by                           | Meaning                                                                                                                                                                                                               |
| ------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GLITCHTIP_DSN`           | `src/lib/instrument.ts`           | The DSN for backend error reporting to GlitchTip, through the Sentry SDK. Empty or unset turns reporting off. In production the process then prints one warning at startup.                                           |
| `GIT_HASH`                | `src/lib/instrument.ts`           | The release tag on each reported error. With a DSN set and no `GIT_HASH`, the process prints a warning at startup.                                                                                                    |
| `SENTRY_ROLE`             | `src/lib/instrument.ts`           | The server name on each reported error, so the three services stay apart. Default `hocuspocus`. Production Compose sets it per service.                                                                               |
| `ENABLE_SCHEMA_MIGRATION` | `src/config/hocuspocus.config.ts` | When on, the collaboration server rebuilds a document that still has the old nested schema or old media node names, when it loads. It saves the rebuilt snapshot. `true` in any case or `1` turns it on. Default off. |
| `RUN_MIGRATIONS`          | `scripts/docker-entrypoint.sh`    | Runs the Prisma migrations when a container starts. Only `1`, the default, runs them. Production Compose sets `0`, because the one-shot `migrate` service runs them.                                                  |
