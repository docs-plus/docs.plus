# @docs.plus/hocuspocus

Backend for docs.plus: a REST API, a real-time collaboration server, and a background worker. Built on Bun, Hono, Prisma, ioredis, and BullMQ.

## Processes

The package ships three independent entry points. Each is its own process and scales separately.

| Process   | Default port    | Entry                      | Role                                                                          |
| --------- | --------------- | -------------------------- | ----------------------------------------------------------------------------- |
| REST API  | `4000`          | `src/index.ts`             | Hono HTTP app: documents, media, link metadata, email triggers, admin, health |
| WebSocket | `4001`          | `src/hocuspocus.server.ts` | Hocuspocus/Y.js collaboration; JWT-authenticated rooms                        |
| Worker    | `4002` (health) | `src/hocuspocus.worker.ts` | Consumes pgmq and runs BullMQ jobs (email, push); idempotency-log cleanup     |

The REST API initializes the email and push gateways in queue-only mode, so it can run as multiple replicas without spawning duplicate workers — the worker process owns job execution. Email and push notifications flow Supabase → pgmq → worker → BullMQ → SMTP / Web Push; there are no `/api/email/send` or `/api/push` HTTP endpoints.

Ports are configurable via `APP_PORT`, `HOCUSPOCUS_PORT`, and `WORKER_HEALTH_PORT` (see [ENV.md](./ENV.md)).

## Tech stack

- **Runtime:** Bun (Node ≥ 24.11.0, Bun ≥ 1.3.7)
- **HTTP:** Hono (REST), Hocuspocus (WebSocket)
- **Database:** PostgreSQL via Prisma (pg adapter)
- **Cache / queue:** Redis via ioredis; pgmq (Postgres queue) feeding BullMQ
- **Validation:** Zod
- **Logging:** Pino

## Development

Use Bun only — never npm, yarn, pnpm, or npx.

```bash
# All three processes (from monorepo root)
make dev-backend

# Or individually, via workspace filters
bun run --filter @docs.plus/hocuspocus dev:rest     # REST API
bun run --filter @docs.plus/hocuspocus dev:ws       # WebSocket
bun run --filter @docs.plus/hocuspocus dev:worker   # Worker
```

The `dev:*` scripts load `../../.env.local`. For Docker-based runs (`make up-dev` / `make up-prod`), config comes from the root `.env.development` / `.env.production`. See [ENV.md](./ENV.md).

## Scripts

| Script                                     | Description                                          |
| ------------------------------------------ | ---------------------------------------------------- |
| `dev:rest` / `dev:ws` / `dev:worker`       | Watch-mode dev for each process                      |
| `start:rest` / `start:ws` / `start:worker` | Production start for each process                    |
| `build`                                    | Bundle all three entries to `dist/` (`--target=bun`) |
| `lint` / `lint:fix`                        | ESLint                                               |
| `typecheck`                                | `tsc --noEmit`                                       |
| `test` / `test:watch` / `test:coverage`    | Bun test runner                                      |
| `prisma:generate`                          | Generate the Prisma client                           |
| `prisma:migrate`                           | Run a dev migration                                  |
| `migrate:nested-to-flat`                   | One-off document migration (`:dry` for a dry run)    |

## Structure

```
src/
├── index.ts                # REST API entry (Hono)
├── hocuspocus.server.ts    # WebSocket entry (Hocuspocus)
├── hocuspocus.worker.ts    # Worker entry (pgmq + BullMQ)
├── api/                    # REST layer: routers, controllers, services, middleware, utils
├── modules/                # Self-contained bounded modules (e.g. link-metadata)
├── config/                 # env.schema.ts, hocuspocus.config
├── extensions/             # Hocuspocus extensions
├── lib/                    # email, push, storage, prisma, redis, queue, logger, errors
├── middleware/             # Global HTTP middleware (CORS, security, rate limit, logging)
├── schemas/                # Zod request schemas
├── types/                  # Shared types
└── utils/                  # Shared utilities
```

## Module pattern

`src/modules/link-metadata` is the canonical bounded-module template — a modular monolith that can be lifted into a standalone service mechanically. Its rules:

- **One public surface.** `index.ts` exports only `init` and the wire types. Outside files import nothing else.
- **DI at the seam.** `init({ redis, logger })` builds its own adapters in a closure; it never calls `getRedisClient()` or reads env directly.
- **Framework-free domain.** `domain/` imports zero infra SDKs (no Hono, ioredis, metascraper). Adapters live in `infra/`; domain↔infra contracts are tiny inline port types in `domain/types.ts`.
- **Stable wire contract.** Request (`http/schema.ts`) and response (`domain/types.ts`) are published; additive changes only within v1.
- **No shared mutable state**, no top-level side effects, and tests ride inside `__tests__/`.

The host wires it in `src/index.ts`:

```ts
const linkMetadataModule = linkMetadata.init({
  redis: getRedisClient(),
  logger: logger.child({ module: 'link-metadata' })
})
app.route('/api/metadata', linkMetadataModule.router)
```

See `src/modules/link-metadata/README.md` for the full boundary rules and extraction plan.

## Documentation

- [API.md](./API.md) — REST endpoints, auth, and response shapes
- [ENV.md](./ENV.md) — environment variables (authoritative source: `src/config/env.schema.ts`)
- [root README](../../README.md) — monorepo setup
