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
- **Headers:** Hono passes through client `Accept-Language` to upstream fetch and varies cache key on it.
- **No `?refresh=1`** in v1 (deferred — stale cache will revalidate naturally after TTL).
- **No batch endpoint** in v1 (deferred — single-fetch latency is bounded by the 8s timeout, and Redis hits are sub-ms).

### Pipeline (each stage short-circuits on hit)

```
canonicalize url
  ↓ strips utm_*, fbclid, gclid, mc_eid, ref_src, igshid, _hsenc, yclid
ssrf guard
  ↓ blocks private/loopback/link-local/.local/.internal (port from existing endpoint)
redis L3 lookup
  ↓ key: meta:v1:{sha1(canonical_url)}:{lang}
oEmbed registry
  ↓ YouTube, Vimeo, X, Spotify, SoundCloud, Reddit, GitHub Gist, CodePen, Figma, Loom, TikTok
special handlers
  ↓ GitHub repo (api.github.com), Wikipedia (REST summary), Reddit (.json suffix)
HTML fetch + metascraper
  ↓ compound UA, charset detection, content-type gate, response.url as base
fallback
  ↓ { title: hostname, favicon: google-favicon-service, success: true }
```

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
  code: 'INVALID_URL' | 'BLOCKED_URL' | 'METHOD_NOT_ALLOWED'
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

`metascraper` + plugin set: `metascraper-title`, `-description`, `-image`, `-logo`, `-author`, `-publisher`, `-url`, `-date`, `-lang`. Better heuristics than `open-graph-scraper`; used in production by Microlink. Adds 7 small npm packages (each ~20–50 LOC of selector logic).

### Caching

- **Redis L3** (positive 24h, negative 10min). Key: `meta:v1:{sha1(canonical_url)}:{lang}`. Stored as JSON.
- **HTTP** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. `Vary: Accept-Language`. Lets Traefik / browser / any future CDN cache responses too.
- **Webapp client L1+L2** (the existing in-memory session cache in `fetchMetadata.ts` + persisted Y.js mark attrs) stays unchanged. No change to client cache strategy.

### Security

- **SSRF:** port the existing `isValidUrl()` from the Next.js endpoint as-is. Block `localhost`, loopback (`127.*`, `[::1]`), private ranges (`10.*`, `192.168.*`, `172.16-31.*`), link-local (`169.254.*`, `0.*`), `*.local`, `*.internal`. Only `http:` / `https:` schemes.
- **Rate limit:** rely on the existing global rate limiter in `packages/hocuspocus.server/src/middleware/index.ts` (currently 100 req / 15 min per IP+UA). **No per-route limiter added** — global is sufficient given v1 has no `?refresh=1` write-amplification path.
- **CORS:** existing middleware allowlist applies as-is.
- **CSP / secureHeaders:** unchanged.
- **Outbound timeout:** 8s. Body cap: 5MB.

### Observability

Pino structured logs already wrap the route via existing `pinoLogger()` middleware. Add per-stage log fields in the service: `pipeline_stage` (`oembed`/`special`/`scrape`/`fallback`), `cache_hit` (bool), `host` (target hostname), `duration_ms`. No new metrics infrastructure.

## Code Layout

```
packages/hocuspocus.server/src/
├── api/
│   ├── metadata.ts                          # one-line re-export, like health.ts
│   ├── routers/metadata.router.ts           # Hono router + zod query validator
│   ├── controllers/metadata.controller.ts   # HTTP shape only
│   └── services/metadata.service.ts         # pipeline orchestrator
├── lib/metadata/
│   ├── canonicalize.ts                      # tracking-param stripping
│   ├── ssrf.ts                              # ported from Next.js endpoint
│   ├── cache.ts                             # Redis wrapper (positive + negative)
│   ├── htmlFetch.ts                         # fetch + charset detect + content-type gate
│   ├── scraper.ts                           # metascraper instance + extraction
│   ├── oembed/
│   │   ├── registry.ts                      # provider lookup table (11 providers)
│   │   └── fetch.ts                         # JSON fetch + normalization to MetadataResponse
│   ├── handlers/
│   │   ├── github.ts                        # api.github.com/repos/{owner}/{repo}
│   │   ├── wikipedia.ts                     # rest_v1/page/summary
│   │   └── reddit.ts                        # append .json
│   └── types.ts                             # MetadataResponse + ErrorResponse + internal types
├── schemas/metadata.schema.ts               # zod query schema
└── index.ts                                 # add: app.route('/api/metadata', metadataRouter)

packages/hocuspocus.server/tests/
├── unit/metadata.canonicalize.test.ts
├── unit/metadata.ssrf.test.ts
├── unit/metadata.cache.test.ts
├── unit/metadata.charset.test.ts
├── unit/metadata.oembed.test.ts
├── unit/metadata.handlers.test.ts
└── integration/metadata.test.ts             # end-to-end via Hono app fetch with mocked outbound

packages/webapp/
├── src/components/TipTap/hyperlinkPopovers/
│   ├── fetchMetadata.ts                     # rewrite: GET ${NEXT_PUBLIC_API_URL}/api/metadata?url=...
│   ├── previewShared.ts                     # consume rich shape; render publisher/author/embed when present
│   └── previewMobileSheet.ts                # consume rich shape (same fields)
└── src/pages/api/metadata.ts                # DELETE
```

## Cutover Plan (high level — full sequence in implementation plan)

1. Add new endpoint + pipeline + tests on `hocuspocus.server`. Endpoint is live but unused.
2. Rewrite webapp client `fetchMetadata.ts` to call the new endpoint with the new shape.
3. Update `previewShared.ts` / `previewMobileSheet.ts` to render new fields (publisher, author, `oembed.html` for embeddable cards).
4. Delete `packages/webapp/src/pages/api/metadata.ts` and remove `cheerio` + `open-graph-scraper` from `packages/webapp/package.json`.
5. Manual smoke on representative URLs (YouTube, X, GitHub repo, Wikipedia article, Cloudflare-fronted news site, random blog, broken/dead URL).

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

## Open Questions

None — all resolved during brainstorming.
