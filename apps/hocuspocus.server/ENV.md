# Environment Variables

The authoritative list, types, defaults, and required/optional status live in `src/config/env.schema.ts`, which validates `process.env` with Zod at startup and exits the process on any invalid value. This document mirrors that schema. When the two disagree, the schema wins — update it first.

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

| Variable             | Type                                    | Default                |
| -------------------- | --------------------------------------- | ---------------------- |
| `NODE_ENV`           | `development` \| `production` \| `test` | `development`          |
| `APP_NAME`           | string                                  | `hocuspocus`           |
| `APP_PORT`           | number                                  | `4000` (REST API)      |
| `HOCUSPOCUS_PORT`    | number                                  | `4001` (WebSocket)     |
| `WORKER_HEALTH_PORT` | number                                  | `4002` (worker health) |

## Security

| Variable                    | Type   | Default | Notes                                                                                                                                            |
| --------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | string | —       | Required for admin routes, internal email endpoints, and server-side Supabase reads. Optional in the schema, but those features fail without it. |
| `JWT_SECRET`                | string | —       | Optional                                                                                                                                         |
| `ALLOWED_ORIGINS`           | list   | `[]`    | CORS allowlist. In production, falls back to `[APP_URL]` when empty. Dev allows any origin.                                                      |
| `RATE_LIMIT_MAX`            | number | `100`   | Requests per 15-minute window (global limiter)                                                                                                   |

## Redis

Redis is optional; features degrade gracefully without it (rate limiting is disabled, Hocuspocus sync/scaling features are unavailable).

| Variable                | Type    | Default     | Notes                                                                                                                                                                  |
| ----------------------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS`                 | boolean | `false`     |                                                                                                                                                                        |
| `REDIS_HOST`            | string  | `localhost` | If unset at runtime, `getRedisClient()` returns `null` (Redis disabled)                                                                                                |
| `REDIS_PORT`            | number  | `6379`      |                                                                                                                                                                        |
| `REDIS_TLS`             | boolean | `false`     |                                                                                                                                                                        |
| `REDIS_CONNECT_TIMEOUT` | number  | `30000`     | ⚠️ `redis.ts` reads this with a hard-coded fallback of `20000`, used only when the var is unset at runtime. The schema default (`30000`) applies when validation runs. |
| `REDIS_COMMAND_TIMEOUT` | number  | `60000`     | ⚠️ `redis.ts` uses `30000` for the shared client and `60000` for dedicated sync/queue connections, both as runtime fallbacks.                                          |
| `REDIS_KEEPALIVE`       | number  | `30000`     |                                                                                                                                                                        |
| `REDIS_MAX_RETRIES`     | number  | `10`        |                                                                                                                                                                        |

## Database pool

Read by `src/lib/prisma.ts`. Several effective defaults differ from the schema — flagged below.

| Variable               | Type   | Schema default | Notes                                                                                                |
| ---------------------- | ------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `DB_POOL_SIZE`         | number | `10`           | ⚠️ `prisma.ts` falls back to `DB_CONNECTION_LIMIT` then `5` when `DB_POOL_SIZE` is unset at runtime. |
| `DB_IDLE_TIMEOUT`      | number | `300000`       | ⚠️ `prisma.ts` runtime fallback is `300000` in development, `30000` otherwise.                       |
| `DB_CONNECT_TIMEOUT`   | number | `10000`        | Matches `prisma.ts`.                                                                                 |
| `DB_STATEMENT_TIMEOUT` | number | `60000`        | ⚠️ `prisma.ts` runtime fallback is `30000`.                                                          |
| `DB_QUERY_TIMEOUT`     | number | `60000`        | ⚠️ `prisma.ts` runtime fallback is `30000`.                                                          |

The pool fallbacks only apply when a variable is absent from `process.env`. Once `env.schema.ts` validates, the schema default is what's set — so in practice set these explicitly to avoid the mismatch.

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

## Email (SMTP)

| Variable                           | Type    | Default             |
| ---------------------------------- | ------- | ------------------- |
| `EMAIL_FROM`                       | string  | —                   |
| `SMTP_FROM_NAME`                   | string  | `docs.plus`         |
| `SMTP_HOST`                        | string  | `''`                |
| `SMTP_PORT`                        | number  | `587`               |
| `SMTP_USER`                        | string  | `''`                |
| `SMTP_PASS`                        | string  | `''`                |
| `SMTP_SECURE`                      | boolean | `false`             |
| `NEW_DOCUMENT_NOTIFICATION_EMAILS` | list    | `[]`                |
| `APP_URL`                          | string  | `https://docs.plus` |
| `EMAIL_WORKER_CONCURRENCY`         | number  | `3`                 |
| `EMAIL_RATE_LIMIT_MAX`             | number  | `50`                |
| `EMAIL_RATE_LIMIT_DURATION`        | number  | `60000`             |

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

| Variable                          | Type   | Default   |
| --------------------------------- | ------ | --------- |
| `WORKER_ERROR_THRESHOLD`          | number | `10`      |
| `WORKER_ERROR_WINDOW_MS`          | number | `60000`   |
| `WORKER_SHUTDOWN_TIMEOUT_MS`      | number | `120000`  |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | number | `3600000` |

## Hocuspocus logger

All boolean, default `false`. Enable per-event logging on the WebSocket server.

`HOCUSPOCUS_LOGGER`, `HOCUSPOCUS_LOGGER_ON_CONNECT`, `HOCUSPOCUS_LOGGER_ON_DISCONNECT`, `HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT`, `HOCUSPOCUS_LOGGER_ON_CHANGE`, `HOCUSPOCUS_LOGGER_ON_UPGRADE`, `HOCUSPOCUS_LOGGER_ON_REQUEST`, `HOCUSPOCUS_LOGGER_ON_LISTEN`, `HOCUSPOCUS_LOGGER_ON_DESTROY`, `HOCUSPOCUS_LOGGER_ON_CONFIGURE`.

## Hocuspocus throttle

| Variable                       | Type    | Default |
| ------------------------------ | ------- | ------- |
| `HOCUSPOCUS_THROTTLE`          | boolean | `false` |
| `HOCUSPOCUS_THROTTLE_ATTEMPTS` | number  | `10`    |
| `HOCUSPOCUS_THROTTLE_BANTIME`  | number  | `60000` |

## Logging

| Variable    | Type                                                                     | Default |
| ----------- | ------------------------------------------------------------------------ | ------- |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info`  |
