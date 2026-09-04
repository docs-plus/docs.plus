# @docs.plus/hocuspocus

Backend for docs.plus: a REST API, a real-time collaboration server, and a background worker. Built on Bun, Hono, Prisma, ioredis, and BullMQ.

## Processes

The package ships three independent entry points. Each is its own process and scales separately.

| Process   | Default port    | Entry                      | Role                                                                                            |
| --------- | --------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| REST API  | `4000`          | `src/index.ts`             | Hono HTTP app: documents, media, link metadata, email triggers, admin, health                   |
| WebSocket | `4001`          | `src/hocuspocus.server.ts` | Hocuspocus/Y.js collaboration; JWT-authenticated rooms                                          |
| Worker    | `4002` (health) | `src/hocuspocus.worker.ts` | Persists `store-documents`; consumes pgmq; runs email and push BullMQ jobs; hourly prune/reaper |

The REST API initializes the email and push gateways in queue-only mode, so it can run as multiple replicas without spawning duplicate workers. The worker process owns job execution, including the store-document persist path. Email and push notifications flow Supabase → pgmq → worker → BullMQ → SMTP / Web Push. There is no `/api/email/send` or `/api/push` HTTP endpoint. `POST /api/email/send-generic` is service-role only.

The WebSocket process also serves an internal HTTP listener on `4003`. It carries `/metrics` and the service-role endpoints that need the live Y.Doc — content apply, version checkpoint, and version restore. It is never Traefik-routed; the REST process reaches it over `HOCUSPOCUS_INTERNAL_URL`.

Ports are configurable via `APP_PORT`, `HOCUSPOCUS_PORT`, `WORKER_HEALTH_PORT`, and `HOCUSPOCUS_INTERNAL_HTTP_PORT` (see [ENV.md](./ENV.md)).

## Tech stack

- **Runtime:** Bun (Node ≥ 24.11.0, Bun ≥ 1.4.0)
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

Linting runs from the monorepo root (`bun run lint` / `bun run lint:fix`); this package has no local lint script.

## Scripts

| Script                                     | Description                                               |
| ------------------------------------------ | --------------------------------------------------------- |
| `dev:rest` / `dev:ws` / `dev:worker`       | Watch-mode dev for each process                           |
| `start:rest` / `start:ws` / `start:worker` | Production start for each process                         |
| `build`                                    | Bundle all three entries to `dist/` (`--target=bun`)      |
| `typecheck`                                | `tsc --noEmit`                                            |
| `test` / `test:watch` / `test:coverage`    | Bun test runner                                           |
| `test:e2e` / `test:e2e:content-inject`     | Real-infra E2E (Postgres + Redis; needs `make dev-local`) |
| `prisma:generate`                          | Generate the Prisma client                                |
| `prisma:migrate`                           | Run a dev migration                                       |
| `migrate:nested-to-flat`                   | One-off document migration (`:dry` for a dry run)         |

## Structure

```
src/
├── index.ts                # REST API entry (Hono)
├── hocuspocus.server.ts    # WebSocket entry (Hocuspocus)
├── hocuspocus.worker.ts    # Worker entry (pgmq + BullMQ)
├── api/                    # REST layer: routers, controllers, services, middleware, utils
├── modules/                # Bounded modules (link-metadata, document-content, document-versions, document-changes, document-conversion, openapi)
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
- **No shared mutable state**, no top-level side effects, and tests live inside `__tests__/`.

The host wires it in `src/index.ts`:

```ts
const linkMetadataModule = linkMetadata.init({
  redis: getRedisClient(),
  logger: logger.child({ module: 'link-metadata' })
})
app.route('/api/metadata', linkMetadataModule.router)
```

See `src/modules/link-metadata/README.md` for the full boundary rules and extraction plan.

`src/modules/document-content` follows the same rules with one documented extension: besides `init(deps): { router }` for the REST process, it exports a second factory `initWsApply(deps): { app }`. Content injection has to run where the live Y.Doc is, so the collaboration process mounts that app on its internal listener.

`src/modules/document-versions` splits the same way for the same reason. `init(deps): { router }` serves the REST routes: the list, the single-version read and the delete are plain Prisma queries. `initWsOps(deps): { app, ops }` runs in the collaboration process, where naming a version and restoring one can reach the live Y.Doc. The `ops` half is handed to the stateless history handler so the editor's own revert drives the same code the REST route reaches over the hop. Two dependencies arrive by injection rather than import: the batch profile lookup, and the snapshot metadata stripper from `lib/queue`. Importing that module into a REST-loaded file would boot a second pair of BullMQ queues and a Redis socket in the REST process.

`src/modules/document-changes` compares two stored snapshots over a time window and reports the result per heading section — see [API.md](./API.md#document-changes) for the window and pairing rules. It is the plain canonical module, with no `initWs*` split. It reads Postgres only and never needs the live Y.Doc, so `index.ts` exports `init` and `InitResult` alone. It consumes the `document-versions` primitives rather than copying them, `canonicalizeBlock` for the equality key and `matchBlocks` for the pairing.

`src/modules/document-conversion` converts a document to `.docx`, Markdown or ODT and reads `.docx` and Markdown back — see [API.md](./API.md#document-conversion) for the fidelity contract. Every format starts from one shared stage, `toPortableJson`. It rewrites the nodes only the editor can render (media embeds become links, upload placeholders disappear) so no writer meets them. DOCX then goes through the shared HTML rendering, while Markdown and ODT are serialized straight from that tree.

## Documentation

- `GET /docs` — Swagger UI, served by the REST process; `GET /openapi.json` for the raw OpenAPI 3.1 document. Request schemas are generated from the live zod schemas. Neither path is Traefik-routed, so they are local/internal only.
- [CHANGELOG.md](./CHANGELOG.md) — operator and API notes for this package
- [API.md](./API.md) — REST endpoints, auth, and response shapes
- [ENV.md](./ENV.md) — environment variables (authoritative source: `src/config/env.schema.ts`)
- [root README](../../README.md) — monorepo setup
