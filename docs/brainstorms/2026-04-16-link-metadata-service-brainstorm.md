# Brainstorm: Link Metadata Service (Backend Endpoint)

**Date:** 2026-04-16
**Status:** spec — pending implementation plan

## What We're Building

A new backend endpoint on `packages/hocuspocus.server` that fetches rich metadata for arbitrary URLs (link unfurling). It replaces `packages/webapp/src/pages/api/metadata.ts` (Next.js API route, deleted at the end of cutover). The webapp's existing hyperlink-preview popover (`packages/webapp/src/components/TipTap/hyperlinkPopovers/`) is rewired to consume the new endpoint and renders a richer card based on the new structured response shape.

`@docs.plus/extension-hyperlink` is **not** modified.

## Why This Approach

- The Next.js endpoint has limited coverage (single-stage HTML scrape, weak User-Agent, no charset detection, no oEmbed, broken relative URL resolution after redirects). Many real-world URLs return "Untitled" or no preview at all.
- Centralizing on the Hono/Bun backend matches the rest of the platform (email, push, documents, hypermultimedia, admin all live there). Removes a Next.js/Bun split for non-page server logic.
- A rich, structured response shape (`publisher`, `author`, `oembed.html`, `image{width,height,alt}`, etc.) lets the editor render Slack/Notion-quality link cards instead of flat title+thumbnail.
- A layered pipeline (oEmbed → special handlers → HTML scrape) is the standard pattern used by Slack-Unfurler, Discord embed-service, Iframely, Microlink, and Linear. It's the only known approach that handles the hostile-to-scraping platforms (X, Instagram) without paid SaaS.

## Key Decisions

### Endpoint shape

- **Method:** `GET /api/metadata?url=<encoded>`
- **Input limits (zod schema):** `url` required, `string().url()`, max length 2048 chars.
- **Headers:** Hono passes through client `Accept-Language` to upstream fetch and varies cache key on it. When the client sends no `Accept-Language`, the cache-key `lang` segment is the literal string `_` (so the no-lang variant doesn't collide with any real language code).
- **HTTP status codes:** `200` for any `success: true` response (including the fallback). `400` for validation/SSRF rejections (`INVALID_URL`, `BLOCKED_URL`). `429` is emitted by the existing global rate-limit middleware in its own shape (not our `ErrorResponse`). The endpoint never returns `5xx` for upstream failures.
- **No `?refresh=1`** in v1 (deferred — stale cache will revalidate naturally after TTL).
- **No batch endpoint** in v1 (deferred — single-fetch latency is bounded by the 8s timeout, and Redis hits are sub-ms).

### Pipeline (each stage short-circuits on success; matched-but-failed stages fall through)

```
canonicalize url
  ↓ strips utm_*, fbclid, gclid, mc_eid, ref_src, igshid, _hsenc, yclid
ssrf guard
  ↓ blocks private/loopback/link-local/.local/.internal (port from existing endpoint)
redis L3 lookup
  ↓ key: meta:v1:{sha1(canonical_url)}:{lang}    (lang = "_" when client sends no Accept-Language)
oEmbed registry                                   (per-call timeout: 3s)
  ↓ YouTube, Vimeo, X, Spotify, SoundCloud, Reddit, GitHub Gist, CodePen, Figma, Loom, TikTok
special handlers                                  (per-call timeout: 3s)
  ↓ GitHub repo (api.github.com), Wikipedia (REST summary), Reddit (.json suffix)
HTML fetch + metascraper                          (per-call timeout: 8s)
  ↓ compound UA, charset detection, content-type gate, response.url as base
fallback                                          (always succeeds; cached as negative — 10min TTL)
  ↓ { title: hostname, favicon: google-favicon-service, success: true }
```

"Hit" means the stage returned a usable response. A stage that _matches_ the URL (e.g. oEmbed registry recognized a YouTube host) but the upstream call errored or timed out falls through to the next stage; it does not fail the request. Total worst-case latency is bounded by the sum of per-stage timeouts (3 + 3 + 8 = 14s); typical case is well under 1s when any earlier stage hits.

### Response shape (rich, industry-standard)

```ts
interface MetadataResponse {
  success: true
  url: string // canonical (post-redirect, post-canonicalization)
  requested_url: string // exactly what the client sent
  title: string
  description?: string
  lang?: string
  media_type?: 'website' | 'article' | 'video' | 'audio' | 'image' | 'profile' | 'document'
  author?: { name?: string; url?: string; avatar?: string }
  publisher?: { name?: string; url?: string; logo?: string; theme_color?: string }
  image?: { url: string; width?: number; height?: number; alt?: string }
  icon?: string // best high-res icon (apple-touch / large favicon)
  favicon?: string // small favicon
  oembed?: {
    type: 'video' | 'rich' | 'photo' | 'link'
    provider: string
    html?: string // safe-to-embed iframe / blockquote
    width?: number
    height?: number
    thumbnail?: string
  }
  published_at?: string // ISO 8601
  modified_at?: string // ISO 8601
  cached: boolean // true if served from L3 cache
  fetched_at: string // ISO 8601
}

interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}
```

The endpoint **never returns 5xx for upstream failures**. Failure to scrape is a normal mode (random URLs in docs). It returns a graceful fallback so the client always renders something useful. 5xx is reserved for our bugs.

### HTML fetch hardening (Tier A)

- **User-Agent:** `Mozilla/5.0 (compatible; DocsPlusBot/1.0; +https://docs.plus) facebookexternalhit/1.1` — compound identity that gets allowlisted by sites that whitelist `facebookexternalhit` while staying transparent about origin.
- **Headers:** `Accept-Language` from client, `Accept-Encoding: gzip, deflate, br`, `Accept: text/html, application/xhtml+xml`.
- **Charset:** detect from `Content-Type` `charset=` first, then scan first 1KB for `<meta charset>` / `<meta http-equiv>`. Decode with the right `TextDecoder`.
- **Content-Type gate:** if not `text/html` / `application/xhtml+xml`, skip cheerio and return a minimal `{ title: filename-from-path, favicon: google-favicon-service }`.
- **Base URL:** use `response.url` (post-redirect) as the base for resolving relative OG image / favicon paths, not the original request URL.
- **Limits:** 8s timeout, 5MB body cap, follow redirects.

### oEmbed registry (Tier B)

Hostname → endpoint map for the 11 providers above. Fetch JSON, normalize into the response shape (`oembed.html` for embed-capable types, `image.url` from `thumbnail_url`, `author` from `author_name`/`author_url`, `publisher` from `provider_name`/`provider_url`).

### Special handlers (Tier C)

- **GitHub repo:** `api.github.com/repos/{owner}/{repo}` → richer than scraping (description, stars, language, topics).
- **Wikipedia article:** `*.wikipedia.org/api/rest_v1/page/summary/{slug}` → clean summary + thumbnail.
- **Reddit thread:** append `.json` to the URL → official JSON response.

### Library

`metascraper` core + 9 plugins: `metascraper-title`, `-description`, `-image`, `-logo`, `-author`, `-publisher`, `-url`, `-date`, `-lang`. Better heuristics than `open-graph-scraper`; used in production by Microlink. Adds 10 small npm packages total (each ~20–50 LOC of selector logic).

### Caching

- **Redis L3** uses the existing main client from `getRedisClient()` in `lib/redis.ts` — no new connection.
  - Positive TTL: 24h (oEmbed / special-handler / metascraper success).
  - Negative TTL: 10min (the hostname-only fallback also uses the negative TTL — it's a successful response shape but represents a fetch failure we want to retry sooner).
  - Key: `meta:v1:{sha1(canonical_url)}:{lang}`.
  - Stored payload: the response body **without** `cached` and `fetched_at` (those are added on read so `cached: true` correctly reflects the L3 hit).
  - The `cached` field in the response means "served from Redis L3" specifically — not the browser session cache.
- **HTTP** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` for positive responses, `public, max-age=600` for negative/fallback responses. `Vary: Accept-Language`. Lets Traefik / browser / any future CDN cache responses too.
- **Webapp client L1+L2** (the existing in-memory session cache in `fetchMetadata.ts` + persisted Y.js mark attrs) stays unchanged. No change to client cache strategy.

### Security

- **SSRF:** port the existing `isValidUrl()` from the Next.js endpoint as-is. Block `localhost`, loopback (`127.*`, `[::1]`), private ranges (`10.*`, `192.168.*`, `172.16-31.*`), link-local (`169.254.*`, `0.*`), `*.local`, `*.internal`. Only `http:` / `https:` schemes.
- **Rate limit:** rely on the existing global rate limiter in `packages/hocuspocus.server/src/middleware/index.ts` (currently `RATE_LIMIT_MAX || 100` req / 15 min per IP+UA, with Docker-network IPs and `x-internal-request: true` exempted). **No per-route limiter added** — global is sufficient given v1 has no `?refresh=1` write-amplification path. Browser-direct calls from the webapp count against the limit; server-to-server calls from the webapp container do not.
- **CORS:** existing middleware allowlist applies as-is.
- **CSP / secureHeaders:** unchanged.
- **Outbound timeout:** 8s. Body cap: 5MB.

### Observability

Pino structured logs already wrap the route via existing `pinoLogger()` middleware. Add per-stage log fields in the service: `pipeline_stage` (`oembed`/`special`/`scrape`/`fallback`), `cache_hit` (bool), `host` (target hostname), `duration_ms`. No new metrics infrastructure.

## Extraction Readiness (modular-monolith design)

The feature ships inside `hocuspocus.server` but is structured as a self-contained module so that future extraction into a standalone microservice is a same-day mechanical move rather than a multi-week refactor.

### The 7 boundary rules

1. **Single bounded folder.** All code, tests, types, and infra adapters live under `modules/link-metadata/`. Files under that path may not import from anywhere outside it except: framework primitives (`hono`), shared logger (`lib/logger`), and the host's `lib/redis` (passed through DI, see rule 3 — never imported from inside the module's domain code).
2. **One public surface.** The module exposes exactly one entry point: `modules/link-metadata/index.ts`, which re-exports `{ router, init, type MetadataResponse, type ErrorResponse }`. The host's `index.ts` imports only from this entry point. Internal files are private by convention (enforced in code review and via an ESLint `no-restricted-imports` rule mirroring the existing `eslint.config.js` patterns).
3. **Dependency injection at the seam.** The module exports `init({ redis, logger })`. It does not call `getRedisClient()` or read env vars itself for infrastructure clients. The host wires concrete instances at startup. The future microservice's `server.ts` does the same wiring with its own Redis + Pino instances.
4. **Framework-free domain.** Files under `modules/link-metadata/domain/` contain pure functions and orchestration logic. They import zero infrastructure SDKs (no `ioredis`, no `hono`, no `metascraper` directly — metascraper is wrapped in `infra/`). They depend only on TypeScript interfaces defined inside the module.
5. **Stable wire contract.** The zod schema in `http/schema.ts` and the `MetadataResponse` / `ErrorResponse` types in `domain/types.ts` are the published contract. Changes are additive (optional fields) within v1; breaking changes mint a new path. The `meta:v1:` cache-key prefix gives an internal version dimension so the future microservice can safely share the same Redis cluster during cutover.
6. **No shared mutable state.** No module-level singletons, no globals, no top-level side effects. The metascraper instance, Redis pool reference, and any other state are constructed inside `init()` and held in closure. Two instances (monolith + extracted service) can run side by side during traffic cutover without colliding.
7. **Tests live inside the module.** `modules/link-metadata/__tests__/` rides with the folder during extraction. Integration tests use the public `init()` with a fake Redis adapter, exactly the way the future standalone server will use it.

### `init()` contract

```ts
// modules/link-metadata/index.ts
export { type MetadataResponse, type ErrorResponse } from './domain/types'

export function init(deps: {
  redis: Redis // ioredis instance (or any compatible client)
  logger: Logger // pino logger (or any compatible)
}): {
  router: Hono // mount with: app.route('/api/metadata', router)
}
```

### Host wiring (today)

```ts
// packages/hocuspocus.server/src/index.ts
import * as linkMetadata from './modules/link-metadata'
import { getRedisClient } from './lib/redis'
import { logger } from './lib/logger'

const metadata = linkMetadata.init({
  redis: getRedisClient(),
  logger: logger.child({ module: 'link-metadata' })
})

app.route('/api/metadata', metadata.router)
```

### Future extraction recipe (for reference — not v1 work)

1. `mv packages/hocuspocus.server/src/modules/link-metadata packages/link-metadata-service/src`
2. Copy `package.json` deps for `metascraper*`, `ioredis`, `hono`, `pino`, `zod` into the new package.
3. Add a 10-line `server.ts` in the new package:

   ```ts
   import { Hono } from 'hono'
   import Redis from 'ioredis'
   import pino from 'pino'
   import * as linkMetadata from './index'

   const metadata = linkMetadata.init({
     redis: new Redis(process.env.REDIS_URL!),
     logger: pino({ name: 'link-metadata' })
   })

   export default new Hono().route('/api/metadata', metadata.router)
   ```

4. Replace the host's import with the new package name and remove the deps that moved.
5. Deploy as a separate process; route traffic via Traefik path rule.

No domain code changes. No client changes (URL shape and response shape are identical).

### What we are deliberately NOT adding for v1

- **Full hexagonal ports/adapters split** (`CacheStore`, `HttpClient`, `Scraper` interfaces with multiple implementations) — premature; one infra adapter per dependency is enough today.
- **Module-internal `/health` endpoint** — host already exposes `/healthz`; the module gets its own only when it becomes a separate process.
- **URL versioning (`/api/v1/metadata`)** — inconsistent with the rest of the platform. The internal `meta:v1:` cache key handles versioning; if the wire contract ever breaks, mint `/api/metadata/v2` then.
- **Module `config.ts` with zod-validated env schema** — only ~3 env vars touch this module; revisit when the surface grows past 5.

## Code Layout

```
packages/hocuspocus.server/src/
├── modules/
│   └── link-metadata/                          # entire bounded context — extractable as-is
│       ├── README.md                           # restates the 7 boundary rules + extraction recipe
│       ├── index.ts                            # PUBLIC: { router, init, types }
│       ├── module.ts                           # init({ redis, logger }) → builds router, returns public API
│       ├── http/
│       │   ├── router.ts                       # Hono router; only file in domain/* tree that imports Hono
│       │   ├── controller.ts                   # request → service → response shape
│       │   └── schema.ts                       # zod query schema (the wire contract)
│       ├── domain/                             # framework-free; no Hono / ioredis / metascraper imports
│       │   ├── pipeline.ts                     # orchestrates stages in order, handles fall-through
│       │   ├── canonicalize.ts                 # tracking-param stripping
│       │   ├── ssrf.ts                         # ported from Next.js endpoint
│       │   ├── types.ts                        # MetadataResponse, ErrorResponse, internal types, port interfaces
│       │   └── stages/
│       │       ├── cache.ts                    # uses CacheStore interface (defined in types.ts)
│       │       ├── oembed.ts                   # provider registry + JSON fetch + normalization (11 providers)
│       │       ├── handlers/
│       │       │   ├── github.ts               # api.github.com/repos/{owner}/{repo}
│       │       │   ├── wikipedia.ts            # rest_v1/page/summary
│       │       │   └── reddit.ts               # append .json
│       │       ├── htmlScrape.ts               # fetch + charset + content-type gate + metascraper
│       │       └── fallback.ts                 # hostname + google-favicon-service
│       ├── infra/                              # the only place SDK adapters live
│       │   ├── redisCache.ts                   # ioredis-backed CacheStore implementation
│       │   └── metascraper.ts                  # metascraper instance factory (10 plugins)
│       └── __tests__/
│           ├── unit/
│           │   ├── canonicalize.test.ts
│           │   ├── ssrf.test.ts
│           │   ├── htmlFetch.test.ts           # charset detection + content-type gate + base-url resolution
│           │   ├── cache.test.ts
│           │   ├── oembed.test.ts
│           │   └── handlers.test.ts
│           └── integration/
│               └── http.test.ts                # spins up via init() with a fake Redis; exercises the router
└── index.ts                                    # one line: app.route('/api/metadata', linkMetadata.router)

packages/webapp/
├── src/components/TipTap/hyperlinkPopovers/
│   ├── fetchMetadata.ts                        # rewrite: GET `${process.env.NEXT_PUBLIC_API_URL}/api/metadata?url=...` (existing env var)
│   ├── previewShared.ts                        # consume rich shape; render publisher/author/embed when present
│   └── previewMobileSheet.ts                   # consume rich shape (same fields)
└── src/pages/api/metadata.ts                   # DELETE
```

## Cutover Plan (high level — full sequence in implementation plan)

1. Scaffold `modules/link-metadata/` with the boundary structure above (empty stubs + README documenting the 7 boundary rules).
2. Implement the domain pipeline + infra adapters + tests inside the module. Wire `init()` from `hocuspocus.server/src/index.ts`. Endpoint is live but unused.
3. Rewrite webapp client `fetchMetadata.ts` to call the new endpoint with the new shape.
4. Update `previewShared.ts` / `previewMobileSheet.ts` to render new fields (publisher, author, `oembed.html` for embeddable cards).
5. Delete `packages/webapp/src/pages/api/metadata.ts` and remove `cheerio` + `open-graph-scraper` from `packages/webapp/package.json`.
6. Manual smoke on representative URLs (YouTube, X, GitHub repo, Wikipedia article, Cloudflare-fronted news site, random blog, broken/dead URL).

## Out of Scope (deferred)

Each item below has a real argument for inclusion but is left out of v1 to keep the surface area lean. Each can be added later without changing the v1 contract.

- **Batch endpoint** (`POST /api/metadata/batch`) — useful when a doc opens with many links; adds another route + schema + controller. Defer until measured need.
- **`?refresh=1` cache bust** — useful when a site updates and preview goes stale; adds a write-amplification path that needs its own rate limit. Stale-while-revalidate already provides eventual consistency.
- **Client-side pre-warming** (fire-and-forget on link paste/create) — biggest perceived-perf win but adds client-side complexity. Defer.
- **Image proxy + resize** (`GET /api/metadata/image?url=...&w=...`) — solves mixed-content + tracking-pixel + bandwidth issues, but adds CPU + storage + a `sharp`/`squoosh` dep.
- **`robots.txt` respect** — ethical / polite, but most preview services skip it (user-initiated requests aren't crawls). Add later behind a config flag if needed.
- **OAuth-enriched fetches** (GitHub/Figma/Loom with user token for private content) — best-in-class for Slack/Linear; requires auth wiring this endpoint doesn't have.
- **WebSocket / queue async pattern** — Slack-style POST → ack → push; necessary at Slack scale, overkill here.
- **Headless-browser fallback** (Playwright for JS-rendered SPAs) — adds ~250MB image weight + cold-start cost; defer until measured need.
- **Per-host outbound rate limit** — defensive against being IP-banned by `github.com` etc; defer until logs show it's needed.
- **Actual extraction into a standalone `link-metadata-service` package** — the boundary structure (see _Extraction Readiness_) makes this a same-day move. Defer until traffic / on-call data justifies a separate process.

## Open Questions

None — all resolved during brainstorming.
