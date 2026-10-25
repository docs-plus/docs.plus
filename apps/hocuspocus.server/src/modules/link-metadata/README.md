# link-metadata module

Self-contained link-unfurling service. Designed as a modular monolith so it can be lifted into a standalone microservice in a same-day mechanical move (see "Future extraction" below).

## Boundary rules (do not violate)

1. **Single bounded folder.** Code, tests, types, infra adapters all live here. Files outside this folder may only import from `./index.ts`.
2. **One public surface.** `index.ts` exports `{ init, LINK_METADATA_MOUNT_PATH, LINK_ICON_PATH, type MetadataResponse, type ErrorResponse }`. The host mounts the router at the first path constant, and the rate limiter matches the second. Nothing else is consumable from outside.
3. **DI at the seam.** Module exports `init({ redis, logger, iconMaxBytes })`. `iconMaxBytes` is optional and defaults to `16384`. The module does not call `getRedisClient()` or read env vars for infra clients.
4. **Framework-free domain.** Files under `domain/` import zero infra SDKs (no `hono`, no `ioredis`, no `metascraper`). `infra/` is the only place SDKs live. Domain↔infra contracts use tiny inline port types declared in `domain/types.ts`.
5. **Stable wire contract.** `http/schema.ts` (request) and `domain/types.ts` `MetadataResponse` / `ErrorResponse` (response) are the published contract. Additive changes only within v1.
6. **No shared mutable state.** No module-level singletons or top-level side effects. Adapters are constructed inside `init()` and held in closure.
7. **Tests live inside the module.** `__tests__/` moves with the folder during extraction.

ESLint enforces parts of rules 1 and 4 via `no-restricted-imports` in `apps/hocuspocus.server/eslint.config.js` (ESM package — `"type": "module"`).

## Favicons

`GET /api/metadata/icon?origin=<origin>` returns one favicon. [API.md](../../../API.md#link-metadata) holds the full contract.

- **Origin only.** The query names a bare origin, never a page. The route fetches `<origin>/favicon.ico` and nothing else. It parses no HTML and reads no `<link rel=icon>`.
- **Sniffed types.** `domain/icon.ts` reads the first bytes. PNG, ICO (image count above 0), GIF, JPEG and WebP pass. SVG, HTML and CUR are a miss. The served `Content-Type` comes from the sniff.
- **Cap.** `readCappedBody` stops the read at `iconMaxBytes`. The host sets it from `LINK_ICON_MAX_BYTES`.
- **No Redis.** The route stores nothing. Each answer carries `Cache-Control`, and the browser HTTP cache does the rest.
- **Not covered by the Markdown-import rule.** The rule "Do not fetch pictures on the server" in `apps/hocuspocus.server/CLAUDE.md` is about Markdown import. This route is a separate feature that fetches one small icon per origin.
- **DNS rebinding.** `safeFetch` checks the DNS answer, then connects in a separate step. A host that changes its answer in between can reach a private address. This route returns bytes from that fetch, so the leak is limited to sniffed image bytes, up to the cap, within 3 s. That risk is accepted.
- **Proxy log.** `pinoLogger` logs `c.req.path`, which has no query. `scripts/traefik/traefik.yml` drops query strings from the Traefik access log, so an icon miss does not log `?origin=` there either. That setting needs Traefik v3.6.18 or later.

## Future extraction (not v1 work)

1. `mv apps/hocuspocus.server/src/modules/link-metadata packages/link-metadata-service/src`
2. Copy `metascraper*`, `ioredis`, `hono`, `pino`, `zod` deps into the new package's `package.json`.
3. Add a 10-line `server.ts`:

   ```ts
   import { Hono } from 'hono'
   import Redis from 'ioredis'
   import pino from 'pino'
   import * as linkMetadata from './index'

   const metadata = linkMetadata.init({
     redis: new Redis(process.env.REDIS_URL!),
     logger: pino({ name: 'link-metadata' })
   })

   export default new Hono().route(linkMetadata.LINK_METADATA_MOUNT_PATH, metadata.router)
   ```

4. Replace the host's import with the new package name.
5. Deploy as a separate process; route via Traefik path rule.

No domain code changes. No client changes (URL + response shape are identical).
