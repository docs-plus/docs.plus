# Configuration

Which file you edit, which process reads it, and what happens when a value is wrong. For the numbered install path, see [Install](install.md).

This page does not list every variable with its type and default. [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) owns that table, and it mirrors the validation schema, so it cannot drift.

## Which file, for which job

| File               | Used by                                            | Tracked in git |
| ------------------ | -------------------------------------------------- | -------------- |
| `.env.example`     | The template you copy. Never read at runtime       | Yes            |
| `.env.production`  | A production deployment, through `--env-file`      | No             |
| `.env.local`       | Local development. `make dev-local` generates it   | No             |
| `.env.development` | Local development defaults. Generated on first run | No             |

Next step: for a server, copy `.env.example` to `.env.production` and edit that one. Leave `.env.example` alone, so the next person still has a clean template.

## Two kinds of value, and the difference matters

**Runtime values** are read when a container starts. Change one, recreate the container, done.

**Build values** are baked into a compiled bundle. Every name starting with `NEXT_PUBLIC_` is one of these. Changing it in `.env.production` does nothing at all until you run `make build` again.

That difference is the most common configuration mistake here. A `NEXT_PUBLIC_` value that looks correct in your environment file can be months out of date in the running bundle.

## Recreate, or the change does not land

Compose gives your shell environment precedence over `--env-file`, and a running container keeps the value it started with.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate
```

Next step: run that after any runtime change, then confirm with `make status-prod`. For a `NEXT_PUBLIC_` change, run `make build` first.

## The groups

`.env.example` is organised into sections. These are the ones that matter for a deployment.

| Group                    | Holds                                | Notes                                                        |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| Application and security | Environment name, ports, secrets     |                                                              |
| Database                 | `DATABASE_URL`                       | Your own PostgreSQL. Nothing in the compose file provides it |
| Redis                    | Host, port, database index, timeouts | Shared by sync, queues, and the rate limiter                 |
| Supabase, server-side    | Project URL, service-role key        | Never expose the service-role key to a browser               |
| Supabase, client-side    | The `NEXT_PUBLIC_` pair              | Build values. See above                                      |
| Storage                  | Endpoint, region, bucket, key pair   | Set `PERSIST_TO_LOCAL_STORAGE=false`                         |
| Email                    | SMTP or Resend credentials           | The worker sends; the API never does                         |
| Push notifications       | VAPID key pair                       | Generate with `bunx web-push generate-vapid-keys`            |
| CORS                     | Allowed origins                      |                                                              |
| Rate limiting            | `RATE_LIMIT_MAX` and the window      | Default is 100 requests per 15 minutes per address           |
| Logging                  | Level and format                     |                                                              |
| Observability            | Metrics and error reporting          | Optional                                                     |

## Three template values to fix before you deploy

The template is written for local development, so three of its defaults are wrong for a server.

**`PERSIST_TO_LOCAL_STORAGE=true`** must become `false`. The REST API runs two replicas with no shared volume, so an upload lands in one container, is invisible to the other, and disappears on redeploy.

**`NEXT_PUBLIC_RESTAPI_URL` must end in `/api`.** There is no `/api/v1` route. An older template carried one, and the neighbouring `SERVER_RESTAPI_URL` was already correct, which is how the mistake survived unnoticed. Check your own `.env` if you copied an early template.

**`ACME_EMAIL` is missing entirely.** Traefik falls back to the maintainer's address for Let's Encrypt registration. Add it.

## Values that do nothing

These appear in the template and are read nowhere. Do not spend time on them.

- `STORAGE_TYPE` — the code branches on `PERSIST_TO_LOCAL_STORAGE` instead.
- `JWT_SECRET` — no consumer, and the production compose file never passes it.
- The four `*_REPLICAS` variables — no compose file reads them. Replica counts are set in `docker-compose.prod.yml` directly.

Next step: leave them as they are. Removing them is a repository change, not a deployment step.

## When a value is wrong

Most misconfiguration here fails quietly rather than loudly. [Install](install.md) lists the silent ones together. Two are worth repeating.

**Redis unavailable turns rate limiting off**, and every request passes. That is deliberate — the alternative was refusing every request while Redis recovered — but it means a Redis problem widens your exposure instead of narrowing it.

**An upload cap under 1 MB is ignored** and floored to 10 MB, with a warning at startup. Next step: read the startup log after a cap change.

## Where to go next

- [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) — every backend variable, its type, and its default.
- [Install](install.md) — the numbered path, and the verification step.
