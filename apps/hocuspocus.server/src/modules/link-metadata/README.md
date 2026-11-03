# link-metadata module

Self-contained link-unfurling service. It is built as a modular monolith, so it can move into a standalone service later. "Future extraction" below lists the steps.

## Boundary rules (do not violate)

1. **Single bounded folder.** Code, tests, types, infra adapters all live here. Files outside this folder may only import from `./index.ts`. One exception: the openapi module reads `http/schema.ts` directly to build the spec. The lint rule does not catch that relative path.
2. **One public surface.** `index.ts` exports `{ init, LINK_METADATA_MOUNT_PATH, LINK_ICON_PATH, LINK_IMAGE_PATH, type MetadataResponse, type ErrorResponse }`. The host mounts the router at the first path constant. The rate limiter matches all three: the icon route spends its own budget, and the metadata and image routes share one. Nothing else is consumable from outside.
3. **DI at the seam.** Module exports `init({ redis, logger, iconMaxBytes, publicUrl })`. `iconMaxBytes` is optional and defaults to `32768`. `publicUrl` is optional and defaults to `null`; the fallback stage builds its `favicon` URL from it. The module does not call `getRedisClient()` or read env vars for infra clients.
4. **Framework-free domain.** Files under `domain/` import zero infra SDKs (no `hono`, no `ioredis`, no `entities`). `infra/` is the only place SDKs live. Domain↔infra contracts use tiny inline port types declared in `domain/types.ts`.
5. **Stable wire contract.** `http/schema.ts` (request) and `domain/types.ts` `MetadataResponse` / `ErrorResponse` (response) are the published contract. Additive changes only within v1. One recorded exception: the fallback's `favicon` changed from a Google URL to this server's icon route URL ([#517](https://github.com/docs-plus/docs.plus/issues/517), maintainer ruling 2026-10-18).
6. **No shared mutable state.** No module-level singletons or top-level side effects. Adapters are constructed inside `init()` and held in closure.
7. **Tests live inside the module.** `__tests__/` moves with the folder during extraction.

ESLint enforces parts of rules 1 and 4 via `no-restricted-imports` in `apps/hocuspocus.server/eslint.config.js` (ESM package — `"type": "module"`).

## Favicons

`GET /api/metadata/icon?origin=<origin>` returns one favicon. [API.md](../../../API.md#link-metadata) holds the full contract.

- **Origin only.** The query names a bare origin, never a page. The route fetches `<origin>/favicon.ico` first.
- **HTML step.** When that file misses, `domain/readHead.ts` reads the head of `<origin>/`: 64 KiB at most, cut at `</head`. `domain/iconLinks.ts` scans that text. Its small regex scanner picks one `rel=icon` or `apple-touch-icon` href and skips SVG and `data:`. It is not the page scraper (`infra/headScraper.ts`): that reads the card fields, and prefers large logos. The page, the href and every redirect go through `safeFetch`.
- **One timer.** Each hop has its own `AbortController` under the route's one 3 s timer. An over-cap read then aborts only its own hop, and the HTML step can still run.
- **Sniffed types.** `domain/relay.ts` reads the first bytes. PNG, ICO (image count above 0), GIF, JPEG and WebP pass. SVG, HTML and CUR are a miss. The served `Content-Type` comes from the sniff.
- **Cap.** `readCappedBody` stops the read at `iconMaxBytes`. The host sets it from `LINK_ICON_MAX_BYTES`.
- **A miss is an empty `204`.** Chrome logs a console error for an image `404`. An `<img>` still fires `onerror` on the `204`.
- **No Redis.** The route stores nothing. Each answer carries `Cache-Control`, and the browser HTTP cache does the rest.
- **Not covered by the Markdown-import rule.** The rule "Do not fetch pictures on the server" in `apps/hocuspocus.server/CLAUDE.md` is about Markdown import. This route is a separate feature that fetches one small icon per origin. `GET /api/metadata/image` is outside that rule too. It relays one page image, under the same guard and sniff, with a 2 MiB cap and a 5 s timer.
- **Our own card skips the network.** The host passes `ownImage` (type `OwnImage` in `domain/types.ts`). The image route calls it first. A docs.plus pad link names this server's own `card.png`, and `ownImage` reads it in process. Through Traefik, every reader's hover would arrive from one address and share one card bucket. This module never imports social-card; `src/index.ts` wires the two.
- **DNS rebinding.** `safeFetch` checks the DNS answer, then connects in a separate step. A host that changes its answer in between can reach a private address. This route returns bytes from that fetch, so the leak is limited to sniffed image bytes, up to the cap, within 3 s. That risk is accepted. The HTML step lets a site name any public image URL, under the same guard.
- **Proxy log.** `pinoLogger` logs `c.req.path`, which has no query. `scripts/traefik/traefik.yml` drops query strings from the Traefik access log, so an icon miss does not log `?origin=` there either. That setting needs Traefik v3.6.18 or later.

## Future extraction (not planned)

1. `mv apps/hocuspocus.server/src/modules/link-metadata packages/link-metadata-service/src`
2. Copy `entities`, `ioredis`, `hono`, `pino`, `zod` deps into the new package's `package.json`.
3. Add a short `server.ts`. It has no default export, because Bun serves a default export a second time on `:3000`:

   ```ts
   import { Hono } from 'hono'
   import Redis from 'ioredis'
   import pino from 'pino'
   import * as linkMetadata from './index'

   const metadata = linkMetadata.init({
     redis: new Redis({
       host: process.env.REDIS_HOST,
       port: Number(process.env.REDIS_PORT),
       password: process.env.REDIS_PASSWORD
     }),
     logger: pino({ name: 'link-metadata' })
   })

   const app = new Hono().route(linkMetadata.LINK_METADATA_MOUNT_PATH, metadata.router)

   Bun.serve({ port: Number(process.env.APP_PORT), fetch: app.fetch })
   ```

4. Replace the host's import with the new package name.
5. Deploy as a separate process; route via Traefik path rule.

No domain code changes. No client changes (URL + response shape are identical).

## Benchmark

[BENCHMARK.md](BENCHMARK.md) holds the parser numbers, the steps to measure them again, and the
check to run after a deploy.
