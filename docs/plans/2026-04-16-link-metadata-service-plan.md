# Link Metadata Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `GET /api/metadata?url=...` on `hocuspocus.server` as a self-contained, extractable module that returns rich link-preview cards (title, description, publisher, author, image, oEmbed iframe) — and rewire the webapp to consume it.

**Architecture:** Modular monolith. All feature code lives in `packages/hocuspocus.server/src/modules/link-metadata/` behind one public surface (`index.ts` exporting `init({ redis, logger }) → { router }`). Domain code is framework-free (no `hono`, no `ioredis`, no `metascraper` imports); infra adapters under `infra/` are the only places SDKs live. Pipeline runs canonicalize → SSRF → Redis L3 → oEmbed → special handlers → metascraper → fallback, short-circuiting on first success and writing successful results back to Redis.

**Tech Stack:** Hono 4, Bun runtime, ioredis, Pino, Zod 4, `@hono/zod-validator`, `metascraper` + 9 plugins, native `fetch`, `bun:test`, `eslint` (`no-restricted-imports` for module boundary).

**Spec:** `docs/brainstorms/2026-04-16-link-metadata-service-brainstorm.md`. Read it before starting. The plan below assumes the spec as ground truth and does not re-litigate decisions.

---

## Execution Note — DO NOT COMMIT

> **The user will review and commit all changes manually.**
>
> Every task below ends with a `Commit` step that runs `git add` / `git commit`. **Skip those steps.** Do not run `git add`, `git commit`, `git push`, or any state-changing git command at any point during execution.
>
> What you _should_ still do at each "Commit" checkpoint:
>
> 1. Run the verification commands listed in the preceding steps (typecheck, tests, lint).
> 2. Confirm the expected output matches.
> 3. Check the box and move to the next task.
>
> Leave changes staged-or-unstaged exactly as your edits produced them — the user will inspect `git status` / `git diff` themselves at the end.

---

## File Structure

Files created or modified, grouped by ownership. Every file in `modules/link-metadata/` is private to that module — only `index.ts` is consumed externally.

**Backend — module (new, all under `packages/hocuspocus.server/src/modules/link-metadata/`):**

| Path                                  | Responsibility                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                           | Restates 7 boundary rules + extraction recipe (so an engineer reading the folder cold understands the constraints).                 |
| `index.ts`                            | **Public surface.** Re-exports `{ init, type MetadataResponse, type ErrorResponse }`. Nothing else.                                 |
| `module.ts`                           | `init({ redis, logger })` constructs adapters, wires the pipeline, returns `{ router }`.                                            |
| `http/schema.ts`                      | Zod schema for query params (the wire contract).                                                                                    |
| `http/controller.ts`                  | Translates `Context` → service call → response (with `cached` + `fetched_at`, status code, cache headers).                          |
| `http/router.ts`                      | Single `GET /` route with `zValidator('query', …)`. The only file in the module that imports `hono`.                                |
| `domain/types.ts`                     | `MetadataResponse`, `ErrorResponse`, inline ports (`Cache`, `Scraper`), internal stage result types.                                |
| `domain/canonicalize.ts`              | Strips tracking params; returns canonical URL string.                                                                               |
| `domain/ssrf.ts`                      | Pure URL validator; rejects loopback / private / link-local / `.local` / `.internal`.                                               |
| `domain/pipeline.ts`                  | Orchestrates stages in order. Owns the fall-through rule and per-stage timeouts.                                                    |
| `domain/stages/cache.ts`              | Reads/writes via the `Cache` port; converts `null` → miss.                                                                          |
| `domain/stages/oembed.ts`             | Provider registry + JSON fetch + normalization to `MetadataResponse`.                                                               |
| `domain/stages/handlers/github.ts`    | `api.github.com/repos/{owner}/{repo}` → `MetadataResponse`.                                                                         |
| `domain/stages/handlers/wikipedia.ts` | `*.wikipedia.org/api/rest_v1/page/summary/{slug}` → `MetadataResponse`.                                                             |
| `domain/stages/handlers/reddit.ts`    | Append `.json`, parse first listing → `MetadataResponse`.                                                                           |
| `domain/stages/htmlScrape.ts`         | Fetch HTML (compound UA, charset detection, content-type gate, body cap), hand to `Scraper` port.                                   |
| `domain/stages/fallback.ts`           | `{ title: hostname, favicon: google-favicon-service }`. Always succeeds.                                                            |
| `infra/redisCache.ts`                 | Implements `Cache` using `ioredis`. The only file that imports `ioredis`.                                                           |
| `infra/metascraper.ts`                | Implements `Scraper` using metascraper + 9 plugins. The only file that imports `metascraper*`.                                      |
| `__tests__/unit/canonicalize.test.ts` | Tracking-param table tests.                                                                                                         |
| `__tests__/unit/ssrf.test.ts`         | Allow/block table tests.                                                                                                            |
| `__tests__/unit/fallback.test.ts`     | Hostname extraction + favicon URL.                                                                                                  |
| `__tests__/unit/cache.test.ts`        | Get/set with mocked Cache port.                                                                                                     |
| `__tests__/unit/oembed.test.ts`       | Provider matching + normalization (mocked fetch).                                                                                   |
| `__tests__/unit/handlers.test.ts`     | All three special handlers (mocked fetch).                                                                                          |
| `__tests__/unit/htmlFetch.test.ts`    | Charset detection, content-type gate, base URL after redirect.                                                                      |
| `__tests__/integration/http.test.ts`  | Spins module via `init({ redis: createMockRedis(), logger: pino-silent })`; exercises router end-to-end with mocked outbound fetch. |

**Backend — host wiring (modified):**

| Path                                          | Change                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/hocuspocus.server/src/index.ts`     | Add 4 lines: import the module, call `init`, mount router at `/api/metadata`.                                                         |
| `packages/hocuspocus.server/eslint.config.js` | Add `no-restricted-imports` rule: files inside `modules/link-metadata/domain/**` may not import `hono`, `ioredis`, or `metascraper*`. |
| `packages/hocuspocus.server/package.json`     | Add `metascraper` + 9 plugins to `dependencies`.                                                                                      |

**Webapp (modified / deleted):**

| Path                                                                            | Change                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/webapp/src/components/TipTap/hyperlinkPopovers/fetchMetadata.ts`      | Rewrite: `GET ${NEXT_PUBLIC_RESTAPI_URL}/metadata?url=…`; new response shape.                                                                           |
| `packages/webapp/src/components/TipTap/hyperlinkPopovers/previewShared.ts`      | Adapt to new `image: { url, … }` shape; render `publisher.name` / `author.name` when present; render `oembed.html` (sanitized) for embed-capable cards. |
| `packages/webapp/src/components/TipTap/hyperlinkPopovers/previewMobileSheet.ts` | No code change — it consumes `previewShared.ts`. (Listed for awareness.)                                                                                |
| `packages/webapp/src/styles/styles.scss`                                        | Add styles for `.metadata-publisher`, `.metadata-embed` (oEmbed iframe wrapper).                                                                        |
| `packages/webapp/src/pages/api/metadata.ts`                                     | **Delete.**                                                                                                                                             |
| `packages/webapp/package.json`                                                  | Remove `cheerio` and `open-graph-scraper` from `dependencies`.                                                                                          |

---

## Phase A — Module Foundation (4 tasks)

### Task 1: Module skeleton + boundary documentation

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/README.md`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/index.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/module.ts`

- [ ] **Step 1: Create the README explaining the boundary rules**

Write `packages/hocuspocus.server/src/modules/link-metadata/README.md`:

````markdown
# link-metadata module

Self-contained link-unfurling service. Designed as a modular monolith so it can be lifted into a standalone microservice in a same-day mechanical move (see "Future extraction" below).

## Boundary rules (do not violate)

1. **Single bounded folder.** Code, tests, types, infra adapters all live here. Files outside this folder may only import from `./index.ts`.
2. **One public surface.** `index.ts` exports `{ init, type MetadataResponse, type ErrorResponse }`. Nothing else is consumable from outside.
3. **DI at the seam.** Module exports `init({ redis, logger })`. It does not call `getRedisClient()` or read env vars for infra clients.
4. **Framework-free domain.** Files under `domain/` import zero infra SDKs (no `hono`, no `ioredis`, no `metascraper`). `infra/` is the only place SDKs live. Domain↔infra contracts use tiny inline port types declared in `domain/types.ts`.
5. **Stable wire contract.** `http/schema.ts` (request) and `domain/types.ts` `MetadataResponse` / `ErrorResponse` (response) are the published contract. Additive changes only within v1.
6. **No shared mutable state.** No module-level singletons or top-level side effects. Adapters are constructed inside `init()` and held in closure.
7. **Tests live inside the module.** `__tests__/` rides with the folder during extraction.

ESLint enforces parts of rules 1 and 4 via `no-restricted-imports` in `packages/hocuspocus.server/eslint.config.js`.

## Future extraction (not v1 work)

1. `mv packages/hocuspocus.server/src/modules/link-metadata packages/link-metadata-service/src`
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

   export default new Hono().route('/api/metadata', metadata.router)
   ```
````

1. Replace the host's import with the new package name.
2. Deploy as a separate process; route via Traefik path rule.

No domain code changes. No client changes (URL + response shape are identical).

````

- [ ] **Step 2: Create the empty public surface**

Write `packages/hocuspocus.server/src/modules/link-metadata/index.ts`:

```ts
export { init } from './module'
export type { ErrorResponse, MetadataResponse } from './domain/types'
````

- [ ] **Step 3: Create the empty `init` stub**

Write `packages/hocuspocus.server/src/modules/link-metadata/module.ts`:

```ts
import { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
}

export const init = (_deps: InitDeps): { router: Hono } => {
  const router = new Hono()
  router.get('/', (c) => c.json({ message: 'link-metadata module: not yet implemented' }, 501))
  return { router }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS (no errors in the new files).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata
git commit -m "feat(metadata): scaffold link-metadata module with boundary rules"
```

---

### Task 2: Domain types (the contract)

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/types.ts`

- [ ] **Step 1: Write the types file**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/types.ts`:

```ts
/**
 * The wire contract (response side). The request side lives in http/schema.ts.
 * Additive changes only within v1; breaking changes mint a new path.
 */
export interface MetadataResponse {
  success: true
  url: string
  requested_url: string
  title: string
  description?: string
  lang?: string
  media_type?: 'website' | 'article' | 'video' | 'audio' | 'image' | 'profile' | 'document'
  author?: { name?: string; url?: string; avatar?: string }
  publisher?: { name?: string; url?: string; logo?: string; theme_color?: string }
  image?: { url: string; width?: number; height?: number; alt?: string }
  icon?: string
  favicon?: string
  oembed?: {
    type: 'video' | 'rich' | 'photo' | 'link'
    provider: string
    html?: string
    width?: number
    height?: number
    thumbnail?: string
  }
  published_at?: string
  modified_at?: string
  cached: boolean
  fetched_at: string
}

export interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}

/** Stage output: either a full success payload or null (no match / failed). */
export type StageResult = Omit<MetadataResponse, 'cached' | 'fetched_at'> | null

/**
 * Inline port: the only thing domain code knows about caching.
 * `infra/redisCache.ts` is the production implementation; tests pass an in-memory fake.
 */
export interface Cache {
  get(key: string): Promise<StageResult | null>
  set(key: string, value: StageResult, ttlSeconds: number): Promise<void>
}

/**
 * Inline port: the only thing domain code knows about HTML scraping.
 * `infra/metascraper.ts` is the production implementation.
 */
export interface Scraper {
  scrape(input: { html: string; url: string }): Promise<{
    title?: string
    description?: string
    image?: string
    logo?: string
    publisher?: string
    author?: string
    date?: string
    lang?: string
    url?: string
  }>
}

/** Per-stage timeouts. Centralized so tests and pipeline agree. */
export const STAGE_TIMEOUT_MS = {
  oembed: 3_000,
  special: 3_000,
  html: 8_000
} as const
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/types.ts
git commit -m "feat(metadata): add domain types and inline ports (Cache, Scraper)"
```

---

### Task 3: ESLint boundary rule

**Files:**

- Modify: `packages/hocuspocus.server/eslint.config.js`

- [ ] **Step 1: Replace the file with one that adds the boundary rule**

Write `packages/hocuspocus.server/eslint.config.js`:

```js
import baseConfig from '../eslint-config/index.js'

export default [
  ...baseConfig,

  // link-metadata module: domain layer must not import infra SDKs.
  // Keeps the module extractable as a microservice (boundary rule 4).
  {
    files: ['src/modules/link-metadata/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['hono', 'hono/*'], message: 'domain/ must be framework-free' },
            { group: ['ioredis'], message: 'domain/ must not import ioredis; use the Cache port' },
            {
              group: ['metascraper', 'metascraper-*'],
              message: 'domain/ must not import metascraper; use the Scraper port'
            }
          ]
        }
      ]
    }
  },

  // link-metadata module: code outside the module must not reach into its internals.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/modules/link-metadata/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/link-metadata/*', '**/modules/link-metadata/**/*'],
              message: 'Import from "./modules/link-metadata" only — internals are private.'
            }
          ]
        }
      ]
    }
  }
]
```

- [ ] **Step 2: Verify the rule fires on a deliberate violation**

Add a temporary import to `module.ts` (this is just to verify the rule):

```ts
// TEMP — verify lint catches this
import 'ioredis'
```

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: ERROR `domain/ must not import ioredis; use the Cache port` — _but_ note that `module.ts` is at the module root, not under `domain/`. So instead, temporarily add the same import to a fresh file `domain/_lint-probe.ts`:

```ts
import 'ioredis'
```

Run lint again.

Expected: ERROR with the configured message. Then **delete `domain/_lint-probe.ts`** and revert any temp changes to `module.ts`.

- [ ] **Step 3: Verify lint passes on the real code**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/hocuspocus.server/eslint.config.js
git commit -m "feat(metadata): enforce link-metadata module boundaries via eslint"
```

---

### Task 4: Add metascraper dependencies

**Files:**

- Modify: `packages/hocuspocus.server/package.json`

- [ ] **Step 1: Add the 10 packages to `dependencies` (alphabetized to match existing order)**

Insert these lines into the `dependencies` block of `packages/hocuspocus.server/package.json`, keeping alphabetical order:

```json
"metascraper": "^5.46.0",
"metascraper-author": "^5.46.0",
"metascraper-date": "^5.46.0",
"metascraper-description": "^5.46.0",
"metascraper-image": "^5.46.0",
"metascraper-lang": "^5.46.0",
"metascraper-logo": "^5.46.0",
"metascraper-publisher": "^5.46.0",
"metascraper-title": "^5.46.0",
"metascraper-url": "^5.46.0",
```

(If `^5.46.0` is not the latest at install time, use whatever `bun add` resolves to in step 2 — the version above is a known-good baseline.)

- [ ] **Step 2: Install**

Run: `bun install`

Expected: lockfile updates; no peer warnings other than pre-existing ones.

- [ ] **Step 3: Sanity-check the import works**

Create a throwaway file `packages/hocuspocus.server/src/modules/link-metadata/_install-probe.ts`:

```ts
import metascraper from 'metascraper'
import author from 'metascraper-author'
import date from 'metascraper-date'
import description from 'metascraper-description'
import image from 'metascraper-image'
import lang from 'metascraper-lang'
import logo from 'metascraper-logo'
import publisher from 'metascraper-publisher'
import title from 'metascraper-title'
import url from 'metascraper-url'

export const probe = metascraper([
  author(),
  date(),
  description(),
  image(),
  lang(),
  logo(),
  publisher(),
  title(),
  url()
])
```

Run: `bunx tsc --noEmit --project packages/hocuspocus.server/tsconfig.json`

Expected: PASS (or warnings about missing types — install `@types/metascraper*` only if needed; metascraper ships its own types since 5.x).

Then **delete `_install-probe.ts`**.

- [ ] **Step 4: Commit**

```bash
git add packages/hocuspocus.server/package.json bun.lock
git commit -m "chore(metadata): add metascraper + 9 plugins as runtime deps"
```

---

## Phase B — Pure Domain Logic (TDD) (3 tasks)

### Task 5: URL canonicalization

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/canonicalize.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/canonicalize.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/canonicalize.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import { canonicalize } from '../../domain/canonicalize'

describe('canonicalize', () => {
  test('strips utm_* params', () => {
    expect(canonicalize('https://example.com/x?utm_source=newsletter&utm_medium=email')).toBe(
      'https://example.com/x'
    )
  })

  test('strips fbclid, gclid, mc_eid, ref_src, igshid, _hsenc, yclid', () => {
    const url =
      'https://example.com/x?fbclid=a&gclid=b&mc_eid=c&ref_src=d&igshid=e&_hsenc=f&yclid=g&keep=1'
    expect(canonicalize(url)).toBe('https://example.com/x?keep=1')
  })

  test('preserves query params not in the strip list', () => {
    expect(canonicalize('https://example.com/?id=42&utm_source=x')).toBe(
      'https://example.com/?id=42'
    )
  })

  test('preserves hash fragment', () => {
    expect(canonicalize('https://example.com/x?utm_source=x#section')).toBe(
      'https://example.com/x#section'
    )
  })

  test('lowercases hostname but preserves path case', () => {
    expect(canonicalize('https://EXAMPLE.com/PATH')).toBe('https://example.com/PATH')
  })

  test('removes default ports (80 for http, 443 for https)', () => {
    expect(canonicalize('https://example.com:443/x')).toBe('https://example.com/x')
    expect(canonicalize('http://example.com:80/x')).toBe('http://example.com/x')
  })

  test('returns the input unchanged if URL parsing fails', () => {
    expect(canonicalize('not a url')).toBe('not a url')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/canonicalize.test.ts`

Expected: FAIL with "Cannot find module '../../domain/canonicalize'".

- [ ] **Step 3: Implement `canonicalize`**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/canonicalize.ts`:

```ts
const TRACKING_PARAM_PREFIXES = ['utm_'] as const
const TRACKING_PARAM_NAMES = new Set([
  'fbclid',
  'gclid',
  'mc_eid',
  'ref_src',
  'igshid',
  '_hsenc',
  'yclid'
])

const isTrackingParam = (name: string): boolean => {
  if (TRACKING_PARAM_NAMES.has(name)) return true
  return TRACKING_PARAM_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/**
 * Strip known tracking params and normalize cosmetic differences (hostname
 * case, default ports). Returns the input unchanged on parse failure — the
 * SSRF stage immediately after will reject malformed input on its own.
 */
export const canonicalize = (rawUrl: string): string => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  const params = parsed.searchParams
  for (const name of [...params.keys()]) {
    if (isTrackingParam(name)) params.delete(name)
  }

  parsed.hostname = parsed.hostname.toLowerCase()

  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = ''
  }

  return parsed.toString()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/canonicalize.test.ts`

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/canonicalize.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/canonicalize.test.ts
git commit -m "feat(metadata): add URL canonicalization (strip tracking params)"
```

---

### Task 6: SSRF guard

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/ssrf.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/ssrf.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/ssrf.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import { isSafeUrl } from '../../domain/ssrf'

describe('isSafeUrl', () => {
  test('allows public https URLs', () => {
    expect(isSafeUrl('https://example.com/x')).toBe(true)
    expect(isSafeUrl('https://docs.plus')).toBe(true)
  })

  test('allows public http URLs', () => {
    expect(isSafeUrl('http://example.com/x')).toBe(true)
  })

  test('blocks non-http(s) protocols', () => {
    expect(isSafeUrl('ftp://example.com/x')).toBe(false)
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<h1>x</h1>')).toBe(false)
  })

  test('blocks localhost and loopback', () => {
    expect(isSafeUrl('http://localhost')).toBe(false)
    expect(isSafeUrl('http://127.0.0.1')).toBe(false)
    expect(isSafeUrl('http://127.0.0.5')).toBe(false)
    expect(isSafeUrl('http://[::1]')).toBe(false)
  })

  test('blocks RFC 1918 private ranges', () => {
    expect(isSafeUrl('http://10.0.0.1')).toBe(false)
    expect(isSafeUrl('http://192.168.1.1')).toBe(false)
    expect(isSafeUrl('http://172.16.0.1')).toBe(false)
    expect(isSafeUrl('http://172.31.255.255')).toBe(false)
  })

  test('allows 172.x outside the 16–31 private range', () => {
    expect(isSafeUrl('http://172.32.0.1')).toBe(true)
    expect(isSafeUrl('http://172.15.0.1')).toBe(true)
  })

  test('blocks link-local and 0.x', () => {
    expect(isSafeUrl('http://169.254.169.254')).toBe(false) // AWS metadata
    expect(isSafeUrl('http://0.0.0.0')).toBe(false)
  })

  test('blocks .local and .internal TLDs', () => {
    expect(isSafeUrl('http://server.local')).toBe(false)
    expect(isSafeUrl('http://api.internal')).toBe(false)
  })

  test('returns false for unparseable input', () => {
    expect(isSafeUrl('not a url')).toBe(false)
    expect(isSafeUrl('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/ssrf.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement `isSafeUrl` (port from Next.js endpoint)**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/ssrf.ts`:

```ts
const PRIVATE_172_RANGE = /^172\.(1[6-9]|2\d|3[01])\./

/**
 * Reject URLs that point at the loopback interface, RFC 1918 private
 * ranges, link-local addresses, or `*.local` / `*.internal` mDNS-style
 * hostnames. Only `http:` and `https:` schemes are allowed.
 *
 * NOTE: This is a hostname-string check, not DNS resolution. It catches
 * the obvious SSRF vectors (cloud metadata endpoints, intranet hosts).
 * A determined attacker can still abuse DNS rebinding; that's an
 * acceptable v1 risk because the endpoint runs in our own egress-firewalled
 * Docker network — same threat model as the existing Next.js endpoint
 * this code replaces.
 */
export const isSafeUrl = (rawUrl: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = parsed.hostname.toLowerCase()

  if (host === 'localhost' || host === '[::1]') return false
  if (host.startsWith('127.')) return false
  if (host.startsWith('10.')) return false
  if (host.startsWith('192.168.')) return false
  if (PRIVATE_172_RANGE.test(host)) return false
  if (host.startsWith('169.254.')) return false
  if (host.startsWith('0.')) return false
  if (host.endsWith('.local') || host.endsWith('.internal')) return false

  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/ssrf.test.ts`

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/ssrf.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/ssrf.test.ts
git commit -m "feat(metadata): add SSRF guard (private/loopback/link-local block)"
```

---

### Task 7: Fallback stage

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/fallback.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/fallback.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/fallback.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import { runFallback } from '../../domain/stages/fallback'

describe('runFallback', () => {
  test('uses hostname as the title', () => {
    const result = runFallback('https://example.com/some/path')
    expect(result.title).toBe('example.com')
  })

  test('returns canonical url and requested url separately', () => {
    const result = runFallback('https://example.com/x', 'https://example.com/x?utm_source=foo')
    expect(result.url).toBe('https://example.com/x')
    expect(result.requested_url).toBe('https://example.com/x?utm_source=foo')
  })

  test('defaults requested_url to canonical when not provided', () => {
    const result = runFallback('https://example.com/x')
    expect(result.requested_url).toBe('https://example.com/x')
  })

  test('emits a google favicon service URL', () => {
    const result = runFallback('https://example.com/x')
    expect(result.favicon).toBe(
      'https://www.google.com/s2/favicons?domain=https%3A%2F%2Fexample.com&sz=64'
    )
  })

  test('still returns a usable shape for unparseable urls', () => {
    const result = runFallback('not a url')
    expect(result.title).toBe('not a url')
    expect(result.url).toBe('not a url')
    expect(result.favicon).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/fallback.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the fallback stage**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/fallback.ts`:

```ts
import type { StageResult } from '../types'

const googleFaviconUrl = (origin: string): string =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=64`

/**
 * Last-resort stage. Always returns a usable shape so the client always
 * has *something* to render. Negative cache TTL applies to this result.
 */
export const runFallback = (
  canonicalUrl: string,
  requestedUrl: string = canonicalUrl
): NonNullable<StageResult> => {
  let parsed: URL | null = null
  try {
    parsed = new URL(canonicalUrl)
  } catch {
    parsed = null
  }

  return {
    success: true,
    url: canonicalUrl,
    requested_url: requestedUrl,
    title: parsed?.hostname || canonicalUrl,
    favicon: parsed ? googleFaviconUrl(parsed.origin) : undefined
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/fallback.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/stages/fallback.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/fallback.test.ts
git commit -m "feat(metadata): add fallback stage (hostname + google favicon)"
```

---

## Phase C — Stages (5 tasks)

### Task 8: Cache stage

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/cache.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import {
  CACHE_TTL_NEGATIVE_S,
  CACHE_TTL_POSITIVE_S,
  cacheKey,
  readCache,
  writeCache
} from '../../domain/stages/cache'
import type { Cache, StageResult } from '../../domain/types'

interface FakeCache extends Cache {
  store: Map<string, StageResult>
  lastTtl: number
}

const makeFakeCache = (): FakeCache => {
  const store = new Map<string, StageResult>()
  const fake: FakeCache = {
    store,
    lastTtl: -1,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, ttl) => {
      store.set(key, value)
      fake.lastTtl = ttl
    }
  }
  return fake
}

const sample: NonNullable<StageResult> = {
  success: true,
  url: 'https://example.com/x',
  requested_url: 'https://example.com/x',
  title: 'Example'
}

describe('cacheKey', () => {
  test('uses meta:v1: prefix and sha1 of the canonical url', () => {
    const key = cacheKey('https://example.com/x', 'en-US')
    expect(key).toMatch(/^meta:v1:[a-f0-9]{40}:en-US$/)
  })

  test('uses "_" when lang is undefined', () => {
    const key = cacheKey('https://example.com/x', undefined)
    expect(key.endsWith(':_')).toBe(true)
  })

  test('two different urls produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://b.com', 'en'))
  })

  test('two different langs produce different keys', () => {
    expect(cacheKey('https://a.com', 'en')).not.toBe(cacheKey('https://a.com', 'fr'))
  })
})

describe('readCache', () => {
  test('returns null on miss', async () => {
    const cache = makeFakeCache()
    expect(await readCache(cache, 'https://example.com', 'en')).toBeNull()
  })

  test('returns stored payload on hit', async () => {
    const cache = makeFakeCache()
    cache.store.set(cacheKey('https://example.com', 'en'), sample)
    expect(await readCache(cache, 'https://example.com', 'en')).toEqual(sample)
  })
})

describe('writeCache', () => {
  test('stores a positive result with positive TTL', async () => {
    const cache = makeFakeCache()
    await writeCache(cache, 'https://example.com', 'en', sample, 'positive')
    expect(cache.lastTtl).toBe(CACHE_TTL_POSITIVE_S)
  })

  test('stores a fallback result with negative TTL', async () => {
    const cache = makeFakeCache()
    await writeCache(cache, 'https://example.com', 'en', sample, 'negative')
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_S)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts`

Expected: FAIL ("Cannot find module '../../domain/stages/cache'").

- [ ] **Step 3: Implement the cache stage**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/cache.ts`:

```ts
import { createHash } from 'node:crypto'

import type { Cache, StageResult } from '../types'

export const CACHE_TTL_POSITIVE_S = 24 * 60 * 60
export const CACHE_TTL_NEGATIVE_S = 10 * 60

/**
 * Cache key shape: `meta:v1:{sha1(canonical_url)}:{lang | '_'}`.
 * The `v1:` prefix gives an internal versioning dimension so the future
 * extracted microservice can share Redis with the monolith during cutover.
 */
export const cacheKey = (canonicalUrl: string, lang: string | undefined): string => {
  const hash = createHash('sha1').update(canonicalUrl).digest('hex')
  return `meta:v1:${hash}:${lang || '_'}`
}

export const readCache = async (
  cache: Cache,
  canonicalUrl: string,
  lang: string | undefined
): Promise<StageResult> => cache.get(cacheKey(canonicalUrl, lang))

export const writeCache = async (
  cache: Cache,
  canonicalUrl: string,
  lang: string | undefined,
  value: NonNullable<StageResult>,
  kind: 'positive' | 'negative'
): Promise<void> => {
  const ttl = kind === 'positive' ? CACHE_TTL_POSITIVE_S : CACHE_TTL_NEGATIVE_S
  await cache.set(cacheKey(canonicalUrl, lang), value, ttl)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts`

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/stages/cache.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts
git commit -m "feat(metadata): add cache stage (sha1+lang key, positive/negative TTLs)"
```

---

### Task 9: oEmbed stage

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/oembed.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/oembed.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/oembed.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { runOembed } from '../../domain/stages/oembed'

describe('runOembed', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns null for hosts without an oEmbed provider', async () => {
    const result = await runOembed('https://random-blog.example.com/post')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('youtube: fetches provider, normalizes to MetadataResponse', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'video',
          provider_name: 'YouTube',
          provider_url: 'https://www.youtube.com/',
          title: 'Test Video',
          author_name: 'Channel',
          author_url: 'https://www.youtube.com/channel/x',
          thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
          html: '<iframe src="..."></iframe>',
          width: 480,
          height: 270
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const result = await runOembed('https://www.youtube.com/watch?v=abc')

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Test Video')
    expect(result!.publisher).toEqual({ name: 'YouTube', url: 'https://www.youtube.com/' })
    expect(result!.author).toEqual({ name: 'Channel', url: 'https://www.youtube.com/channel/x' })
    expect(result!.image).toEqual({ url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' })
    expect(result!.oembed).toEqual({
      type: 'video',
      provider: 'YouTube',
      html: '<iframe src="..."></iframe>',
      width: 480,
      height: 270,
      thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg'
    })
    expect(result!.media_type).toBe('video')
  })

  test('returns null when provider responds non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }))
    const result = await runOembed('https://www.youtube.com/watch?v=abc')
    expect(result).toBeNull()
  })

  test('returns null when fetch throws (network / abort)', async () => {
    fetchSpy.mockRejectedValue(new Error('aborted'))
    const result = await runOembed('https://www.youtube.com/watch?v=abc')
    expect(result).toBeNull()
  })

  test('respects per-call timeout via AbortSignal', async () => {
    let receivedSignal: AbortSignal | undefined
    fetchSpy.mockImplementation(async (_url, init) => {
      receivedSignal = (init as RequestInit).signal as AbortSignal
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })
    await runOembed('https://www.youtube.com/watch?v=abc')
    expect(receivedSignal).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/oembed.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the oEmbed stage**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/oembed.ts`:

```ts
import { STAGE_TIMEOUT_MS, type StageResult } from '../types'

interface ProviderEntry {
  match: (host: string) => boolean
  endpoint: (url: string) => string
}

/**
 * Provider registry. Each entry knows how to recognize a URL and where
 * to fetch its oEmbed JSON. Order doesn't matter; matching is hostname-based.
 *
 * Sources for endpoints: each provider's published oEmbed docs (oembed.com
 * registry). All these return JSON when given `?format=json&url=…`.
 */
const PROVIDERS: ProviderEntry[] = [
  {
    match: (h) => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h),
    endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)vimeo\.com$/.test(h),
    endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h),
    endpoint: (u) => `https://publish.twitter.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)open\.spotify\.com$|(^|\.)spotify\.com$/.test(h),
    endpoint: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)soundcloud\.com$/.test(h),
    endpoint: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)reddit\.com$/.test(h),
    endpoint: (u) => `https://www.reddit.com/oembed?url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)gist\.github\.com$/.test(h),
    endpoint: (u) => `https://github.com/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)codepen\.io$/.test(h),
    endpoint: (u) => `https://codepen.io/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)figma\.com$/.test(h),
    endpoint: (u) => `https://www.figma.com/api/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)loom\.com$/.test(h),
    endpoint: (u) => `https://www.loom.com/v1/oembed?format=json&url=${encodeURIComponent(u)}`
  },
  {
    match: (h) => /(^|\.)tiktok\.com$/.test(h),
    endpoint: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`
  }
]

interface OembedJson {
  type?: 'video' | 'rich' | 'photo' | 'link'
  title?: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  thumbnail_url?: string
  html?: string
  width?: number
  height?: number
}

const findProvider = (url: string): ProviderEntry | null => {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  return PROVIDERS.find((p) => p.match(host)) ?? null
}

const oembedTypeToMediaType = (
  type: OembedJson['type']
): NonNullable<StageResult>['media_type'] => {
  if (type === 'video') return 'video'
  if (type === 'photo') return 'image'
  return 'website'
}

/**
 * Fetch an oEmbed provider's JSON and normalize it into our response
 * shape. Returns null on no-match, non-2xx, abort, or unparseable JSON.
 * The pipeline calls the next stage on null.
 */
export const runOembed = async (canonicalUrl: string): Promise<StageResult> => {
  const provider = findProvider(canonicalUrl)
  if (!provider) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.oembed)

  try {
    const response = await fetch(provider.endpoint(canonicalUrl), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return null

    const data = (await response.json()) as OembedJson

    return {
      success: true,
      url: canonicalUrl,
      requested_url: canonicalUrl,
      title: data.title || new URL(canonicalUrl).hostname,
      media_type: oembedTypeToMediaType(data.type),
      author:
        data.author_name || data.author_url
          ? { name: data.author_name, url: data.author_url }
          : undefined,
      publisher:
        data.provider_name || data.provider_url
          ? { name: data.provider_name, url: data.provider_url }
          : undefined,
      image: data.thumbnail_url ? { url: data.thumbnail_url } : undefined,
      oembed: {
        type: data.type ?? 'rich',
        provider: data.provider_name ?? '',
        html: data.html,
        width: data.width,
        height: data.height,
        thumbnail: data.thumbnail_url
      }
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/oembed.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/stages/oembed.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/oembed.test.ts
git commit -m "feat(metadata): add oembed stage with 11 provider registry"
```

---

### Task 10: Special handlers (GitHub, Wikipedia, Reddit)

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/handlers.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/github.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/wikipedia.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/reddit.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/index.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/handlers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { runSpecialHandler } from '../../domain/stages/handlers'

describe('runSpecialHandler', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns null for hosts without a special handler', async () => {
    const result = await runSpecialHandler('https://random.example.com/x')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe('github', () => {
    test('fetches api.github.com/repos/{owner}/{repo} and normalizes', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            full_name: 'docsplus/docsy',
            description: 'collaborative docs',
            html_url: 'https://github.com/docsplus/docsy',
            stargazers_count: 42,
            language: 'TypeScript',
            owner: { avatar_url: 'https://avatars.githubusercontent.com/x' }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler('https://github.com/docsplus/docsy')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/docsplus/docsy',
        expect.objectContaining({ headers: expect.any(Object) })
      )
      expect(result?.title).toBe('docsplus/docsy')
      expect(result?.description).toBe('collaborative docs')
      expect(result?.publisher?.name).toBe('GitHub')
      expect(result?.image?.url).toBe('https://avatars.githubusercontent.com/x')
    })

    test('skips non-repo github paths (issues, pulls, etc.)', async () => {
      const result = await runSpecialHandler('https://github.com/docsplus/docsy/issues/123')
      expect(result).toBeNull()
    })
  })

  describe('wikipedia', () => {
    test('fetches REST summary and normalizes', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Albert Einstein',
            extract: 'Theoretical physicist',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Albert_Einstein' } },
            thumbnail: { source: 'https://upload.wikimedia.org/x.jpg', width: 200, height: 250 }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler('https://en.wikipedia.org/wiki/Albert_Einstein')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/Albert_Einstein',
        expect.any(Object)
      )
      expect(result?.title).toBe('Albert Einstein')
      expect(result?.description).toBe('Theoretical physicist')
      expect(result?.image?.url).toBe('https://upload.wikimedia.org/x.jpg')
      expect(result?.publisher?.name).toBe('Wikipedia')
    })
  })

  describe('reddit', () => {
    test('appends .json and parses first listing', async () => {
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              data: {
                children: [
                  {
                    data: {
                      title: 'Cool post',
                      selftext: 'lorem ipsum',
                      author: 'someuser',
                      subreddit_name_prefixed: 'r/programming',
                      thumbnail: 'https://b.thumbs.redditmedia.com/x.jpg'
                    }
                  }
                ]
              }
            }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )

      const result = await runSpecialHandler(
        'https://www.reddit.com/r/programming/comments/abc/cool_post'
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.reddit.com/r/programming/comments/abc/cool_post.json',
        expect.any(Object)
      )
      expect(result?.title).toBe('Cool post')
      expect(result?.author?.name).toBe('someuser')
      expect(result?.publisher?.name).toBe('r/programming')
    })
  })

  test('returns null on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }))
    const result = await runSpecialHandler('https://github.com/docsplus/docsy')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/handlers.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the github handler**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/github.ts`:

```ts
import { STAGE_TIMEOUT_MS, type StageResult } from '../../types'

const REPO_PATH = /^\/([^/]+)\/([^/]+)\/?$/

export const matchesGithub = (
  host: string,
  path: string
): { owner: string; repo: string } | null => {
  if (host !== 'github.com' && host !== 'www.github.com') return null
  const m = REPO_PATH.exec(path)
  return m ? { owner: m[1], repo: m[2] } : null
}

interface RepoJson {
  full_name?: string
  description?: string
  html_url?: string
  language?: string
  stargazers_count?: number
  owner?: { avatar_url?: string }
}

export const runGithub = async (
  canonicalUrl: string,
  owner: string,
  repo: string,
  signal: AbortSignal
): Promise<StageResult> => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    signal,
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) return null
  const data = (await response.json()) as RepoJson

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: data.full_name ?? `${owner}/${repo}`,
    description: data.description,
    publisher: { name: 'GitHub', url: 'https://github.com' },
    image: data.owner?.avatar_url ? { url: data.owner.avatar_url } : undefined
  }
}
```

- [ ] **Step 4: Implement the wikipedia handler**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/wikipedia.ts`:

```ts
import { type StageResult } from '../../types'

const WIKI_HOST = /^([a-z-]+)\.wikipedia\.org$/
const WIKI_PATH = /^\/wiki\/([^/]+)\/?$/

export const matchesWikipedia = (
  host: string,
  path: string
): { lang: string; slug: string } | null => {
  const hostMatch = WIKI_HOST.exec(host)
  if (!hostMatch) return null
  const pathMatch = WIKI_PATH.exec(path)
  if (!pathMatch) return null
  return { lang: hostMatch[1], slug: pathMatch[1] }
}

interface SummaryJson {
  title?: string
  extract?: string
  thumbnail?: { source?: string; width?: number; height?: number }
}

export const runWikipedia = async (
  canonicalUrl: string,
  lang: string,
  slug: string,
  signal: AbortSignal
): Promise<StageResult> => {
  const response = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    signal,
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) return null
  const data = (await response.json()) as SummaryJson

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: data.title ?? slug.replace(/_/g, ' '),
    description: data.extract,
    publisher: { name: 'Wikipedia', url: `https://${lang}.wikipedia.org` },
    image: data.thumbnail?.source
      ? { url: data.thumbnail.source, width: data.thumbnail.width, height: data.thumbnail.height }
      : undefined
  }
}
```

- [ ] **Step 5: Implement the reddit handler**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/reddit.ts`:

```ts
import { type StageResult } from '../../types'

export const matchesReddit = (host: string, path: string): boolean =>
  /(^|\.)reddit\.com$/.test(host) && /^\/r\/[^/]+\/comments\//.test(path)

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string
        selftext?: string
        author?: string
        subreddit_name_prefixed?: string
        thumbnail?: string
      }
    }>
  }
}

export const runReddit = async (
  canonicalUrl: string,
  signal: AbortSignal
): Promise<StageResult> => {
  // Use the response.url after `.json` so canonical+requested both end up correct
  const jsonUrl = canonicalUrl.endsWith('.json') ? canonicalUrl : `${canonicalUrl}.json`
  const response = await fetch(jsonUrl, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': 'DocsPlusBot/1.0' }
  })
  if (!response.ok) return null
  const listings = (await response.json()) as RedditListing[]
  const post = listings[0]?.data?.children?.[0]?.data
  if (!post?.title) return null

  const validThumbnail =
    post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined

  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: post.title,
    description: post.selftext || undefined,
    author: post.author ? { name: post.author } : undefined,
    publisher: post.subreddit_name_prefixed
      ? { name: post.subreddit_name_prefixed, url: 'https://www.reddit.com' }
      : { name: 'Reddit', url: 'https://www.reddit.com' },
    image: validThumbnail ? { url: validThumbnail } : undefined
  }
}
```

- [ ] **Step 6: Implement the dispatcher**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers/index.ts`:

```ts
import { STAGE_TIMEOUT_MS, type StageResult } from '../../types'
import { matchesGithub, runGithub } from './github'
import { matchesReddit, runReddit } from './reddit'
import { matchesWikipedia, runWikipedia } from './wikipedia'

/**
 * Try the first matching special handler. Returns null on no-match,
 * non-2xx, abort, or unparseable JSON. The pipeline calls the next stage
 * (HTML scrape) on null.
 */
export const runSpecialHandler = async (canonicalUrl: string): Promise<StageResult> => {
  let parsed: URL
  try {
    parsed = new URL(canonicalUrl)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.special)

  try {
    const gh = matchesGithub(host, path)
    if (gh) return await runGithub(canonicalUrl, gh.owner, gh.repo, controller.signal)

    const wiki = matchesWikipedia(host, path)
    if (wiki) return await runWikipedia(canonicalUrl, wiki.lang, wiki.slug, controller.signal)

    if (matchesReddit(host, path)) return await runReddit(canonicalUrl, controller.signal)

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/handlers.test.ts`

Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/stages/handlers \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/handlers.test.ts
git commit -m "feat(metadata): add special handlers for github, wikipedia, reddit"
```

---

### Task 11: HTML scrape stage

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/htmlFetch.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/htmlScrape.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/htmlFetch.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { runHtmlScrape } from '../../domain/stages/htmlScrape'
import type { Scraper } from '../../domain/types'

const noopScraper: Scraper = { scrape: async () => ({ title: 'scraped' }) }

const html = (charset: string, body: string): string =>
  `<!doctype html><html><head><meta charset="${charset}"><title>x</title></head><body>${body}</body></html>`

describe('runHtmlScrape', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('passes Accept-Language and compound User-Agent', async () => {
    fetchSpy.mockResolvedValue(
      new Response(html('utf-8', 'ok'), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    await runHtmlScrape('https://example.com', noopScraper, 'fr-FR')

    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    const headers = new Headers(init.headers as HeadersInit)
    expect(headers.get('accept-language')).toBe('fr-FR')
    expect(headers.get('user-agent')).toContain('DocsPlusBot')
    expect(headers.get('user-agent')).toContain('facebookexternalhit')
  })

  test('uses Content-Type charset to decode body', async () => {
    const utf16Bytes = new TextEncoder().encode('utf8 body') // assume utf-8 announced
    fetchSpy.mockResolvedValue(
      new Response(utf16Bytes, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    )

    let receivedHtml = ''
    const scraper: Scraper = {
      scrape: async ({ html: h }) => {
        receivedHtml = h
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://example.com', scraper, undefined)
    expect(receivedHtml).toContain('utf8 body')
  })

  test('falls back to <meta charset> when Content-Type lacks charset', async () => {
    const body = html('iso-8859-1', 'café')
    // Encode body as iso-8859-1 (latin1)
    const bytes = new Uint8Array(body.length)
    for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff

    fetchSpy.mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'text/html' } // no charset
      })
    )

    let receivedHtml = ''
    const scraper: Scraper = {
      scrape: async ({ html: h }) => {
        receivedHtml = h
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://example.com', scraper, undefined)
    expect(receivedHtml).toContain('café')
  })

  test('returns minimal shape when content-type is not HTML', async () => {
    fetchSpy.mockResolvedValue(
      new Response('PDF binary blob', {
        status: 200,
        headers: { 'content-type': 'application/pdf' }
      })
    )

    const result = await runHtmlScrape('https://example.com/file.pdf', noopScraper, undefined)
    expect(result?.title).toBe('file.pdf')
    expect(result?.media_type).toBe('document')
  })

  test('uses response.url (post-redirect) as scraper base', async () => {
    fetchSpy.mockResolvedValue(
      Object.assign(
        new Response(html('utf-8', 'ok'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        }),
        { url: 'https://final.example.com/x' }
      )
    )

    let receivedUrl = ''
    const scraper: Scraper = {
      scrape: async ({ url }) => {
        receivedUrl = url
        return { title: 'x' }
      }
    }

    await runHtmlScrape('https://short.example.com/redirect', scraper, undefined)
    expect(receivedUrl).toBe('https://final.example.com/x')
  })

  test('returns null on non-2xx', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 503 }))
    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBeNull()
  })

  test('aborts when body exceeds 5MB cap', async () => {
    const big = new Uint8Array(6 * 1024 * 1024) // 6MB
    fetchSpy.mockResolvedValue(
      new Response(big, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': String(big.byteLength) }
      })
    )
    const result = await runHtmlScrape('https://example.com', noopScraper, undefined)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/htmlFetch.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the HTML scrape stage**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/stages/htmlScrape.ts`:

```ts
import { Scraper, STAGE_TIMEOUT_MS, type StageResult } from '../types'

const USER_AGENT =
  'Mozilla/5.0 (compatible; DocsPlusBot/1.0; +https://docs.plus) facebookexternalhit/1.1'
const MAX_BODY_BYTES = 5 * 1024 * 1024

const META_CHARSET_RE = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i
const META_HTTP_EQUIV_RE =
  /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i

const parseCharsetFromHeader = (contentType: string | null): string | null => {
  if (!contentType) return null
  const m = /charset=([\w-]+)/i.exec(contentType)
  return m ? m[1].toLowerCase() : null
}

const parseCharsetFromMeta = (firstKb: string): string | null => {
  const m = META_CHARSET_RE.exec(firstKb) ?? META_HTTP_EQUIV_RE.exec(firstKb)
  return m ? m[1].toLowerCase() : null
}

const isHtml = (contentType: string | null): boolean => {
  if (!contentType) return false
  const lower = contentType.toLowerCase()
  return lower.includes('text/html') || lower.includes('application/xhtml+xml')
}

const filenameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').filter(Boolean).pop()
    return last || new URL(url).hostname
  } catch {
    return url
  }
}

const decodeBody = (bytes: Uint8Array, contentType: string | null): string => {
  let charset = parseCharsetFromHeader(contentType)
  if (!charset) {
    const firstKb = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024))
    charset = parseCharsetFromMeta(firstKb)
  }
  try {
    return new TextDecoder(charset || 'utf-8', { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }
}

/**
 * Tier C: full HTML fetch + metascraper. Hardened against:
 *   - hostile-to-bot sites (compound UA gets allowlisted by sites that
 *     trust facebookexternalhit while staying transparent)
 *   - non-HTML responses (PDF, image direct links → minimal shape)
 *   - mis-declared / missing charsets (Content-Type → meta → utf-8)
 *   - oversized bodies (5MB cap)
 *   - relative OG image / favicon paths after redirects (uses response.url)
 */
export const runHtmlScrape = async (
  canonicalUrl: string,
  scraper: Scraper,
  acceptLanguage: string | undefined
): Promise<StageResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STAGE_TIMEOUT_MS.html)

  try {
    const response = await fetch(canonicalUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html, application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate, br',
        ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {})
      }
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type')
    const declaredLength = parseInt(response.headers.get('content-length') ?? '0', 10)
    if (declaredLength > MAX_BODY_BYTES) return null

    const baseUrl = response.url || canonicalUrl

    // Non-HTML: skip metascraper, return a minimal shape with the filename.
    if (!isHtml(contentType)) {
      return {
        success: true,
        url: baseUrl,
        requested_url: canonicalUrl,
        title: filenameFromUrl(baseUrl),
        media_type: 'document'
      }
    }

    const buf = new Uint8Array(await response.arrayBuffer())
    if (buf.byteLength > MAX_BODY_BYTES) return null

    const html = decodeBody(buf, contentType)
    const meta = await scraper.scrape({ html, url: baseUrl })

    if (!meta.title) return null

    return {
      success: true,
      url: baseUrl,
      requested_url: canonicalUrl,
      title: meta.title,
      description: meta.description,
      lang: meta.lang,
      author: meta.author ? { name: meta.author } : undefined,
      publisher: meta.publisher ? { name: meta.publisher } : undefined,
      image: meta.image ? { url: meta.image } : undefined,
      icon: meta.logo,
      published_at: meta.date
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/htmlFetch.test.ts`

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/stages/htmlScrape.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/htmlFetch.test.ts
git commit -m "feat(metadata): add HTML scrape stage (charset, content-type gate, 5MB cap)"
```

---

### Task 12: Pipeline orchestrator

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/pipeline.test.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/domain/pipeline.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/pipeline.test.ts`:

```ts
import { describe, expect, mock, test } from 'bun:test'

import { runPipeline } from '../../domain/pipeline'
import type { Cache, Scraper, StageResult } from '../../domain/types'

interface FakeCache extends Cache {
  lastTtl: number
}

const fakeCache = (): FakeCache => {
  const store = new Map<string, StageResult>()
  const fake: FakeCache = {
    lastTtl: -1,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v, ttl) => {
      store.set(k, v)
      fake.lastTtl = ttl
    }
  }
  return fake
}

const ok = (title: string): NonNullable<StageResult> => ({
  success: true,
  url: 'https://example.com',
  requested_url: 'https://example.com',
  title
})

const noopScraper: Scraper = { scrape: async () => ({}) }

describe('runPipeline', () => {
  test('rejects unparseable URL with INVALID_URL', async () => {
    const result = await runPipeline({
      requestedUrl: 'not a url',
      acceptLanguage: undefined,
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.code).toBe('INVALID_URL')
  })

  test('rejects private IP with BLOCKED_URL', async () => {
    const result = await runPipeline({
      requestedUrl: 'http://192.168.1.1',
      acceptLanguage: undefined,
      cache: fakeCache(),
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })
    expect(result.kind).toBe('error')
    if (result.kind === 'error') expect(result.code).toBe('BLOCKED_URL')
  })

  test('returns L3 cache hit without calling stages', async () => {
    const cache = fakeCache()
    await cache.set('any', ok('cached'), 60) // store under any key just to fill it
    const oembed = mock(async () => null)
    // Pre-seed the right key
    const cache2 = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    await cache2.set(cacheKey('https://example.com/', 'en'), ok('cached'), 60)

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache: cache2,
      scraper: noopScraper,
      stages: { oembed, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.title).toBe('cached')
      expect(result.fromCache).toBe(true)
    }
    expect(oembed).not.toHaveBeenCalled()
  })

  test('returns first-hit stage and writes positive cache', async () => {
    const cache = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    const oembed = mock(async () => ok('oembed'))
    const special = mock(async () => ok('special'))
    const html = mock(async () => ok('html'))

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed, special, html }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('oembed')
    expect(special).not.toHaveBeenCalled()
    expect(html).not.toHaveBeenCalled()
    expect(await cache.get(cacheKey('https://example.com/', 'en'))).not.toBeNull()
  })

  test('falls through when earlier stages return null', async () => {
    const cache = fakeCache()
    const html = mock(async () => ok('html'))

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('html')
    expect(html).toHaveBeenCalled()
  })

  test('returns fallback (negative cache) when all stages return null', async () => {
    const cache = fakeCache()
    const { CACHE_TTL_NEGATIVE_S } = await import('../../domain/stages/cache')

    const result = await runPipeline({
      requestedUrl: 'https://example.com/',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.payload.title).toBe('example.com')
    expect(cache.lastTtl).toBe(CACHE_TTL_NEGATIVE_S)
  })

  test('canonicalizes the requested URL before SSRF + cache lookup', async () => {
    const cache = fakeCache()
    const { cacheKey } = await import('../../domain/stages/cache')
    await cache.set(cacheKey('https://example.com/', 'en'), ok('cached'), 60)

    const result = await runPipeline({
      requestedUrl: 'https://EXAMPLE.com/?utm_source=x',
      acceptLanguage: 'en',
      cache,
      scraper: noopScraper,
      stages: { oembed: async () => null, special: async () => null, html: async () => null }
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.payload.title).toBe('cached')
      expect(result.payload.requested_url).toBe('https://EXAMPLE.com/?utm_source=x')
      expect(result.payload.url).toBe('https://example.com/')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/pipeline.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the pipeline**

Write `packages/hocuspocus.server/src/modules/link-metadata/domain/pipeline.ts`:

```ts
import { canonicalize } from './canonicalize'
import { isSafeUrl } from './ssrf'
import { readCache, writeCache } from './stages/cache'
import { runFallback } from './stages/fallback'
import type { Cache, ErrorResponse, Scraper, StageResult } from './types'

export interface PipelineStages {
  oembed: (canonicalUrl: string) => Promise<StageResult>
  special: (canonicalUrl: string) => Promise<StageResult>
  html: (
    canonicalUrl: string,
    scraper: Scraper,
    acceptLanguage: string | undefined
  ) => Promise<StageResult>
}

export interface PipelineInput {
  requestedUrl: string
  acceptLanguage: string | undefined
  cache: Cache
  scraper: Scraper
  stages: PipelineStages
  /** Optional logger hook the controller wires up; pipeline stays framework-free. */
  onStage?: (event: { stage: string; hit: boolean; durationMs: number }) => void
}

export type PipelineResult =
  | { kind: 'success'; payload: NonNullable<StageResult>; fromCache: boolean }
  | { kind: 'error'; status: 400; message: string; code: ErrorResponse['code'] }

const orderedStageNames = ['oembed', 'special', 'html'] as const

export const runPipeline = async (input: PipelineInput): Promise<PipelineResult> => {
  const { requestedUrl, acceptLanguage, cache, scraper, stages, onStage } = input

  if (!isSafeUrl(requestedUrl)) {
    let parsed: URL | null = null
    try {
      parsed = new URL(requestedUrl)
    } catch {
      // fallthrough
    }
    return parsed
      ? { kind: 'error', status: 400, message: 'URL is not allowed', code: 'BLOCKED_URL' }
      : { kind: 'error', status: 400, message: 'URL is not valid', code: 'INVALID_URL' }
  }

  const canonical = canonicalize(requestedUrl)

  const cached = await readCache(cache, canonical, acceptLanguage)
  if (cached) {
    return {
      kind: 'success',
      payload: { ...cached, requested_url: requestedUrl },
      fromCache: true
    }
  }

  for (const name of orderedStageNames) {
    const start = Date.now()
    const result =
      name === 'html'
        ? await stages.html(canonical, scraper, acceptLanguage)
        : await stages[name](canonical)
    onStage?.({ stage: name, hit: result !== null, durationMs: Date.now() - start })

    if (result) {
      const withRequested = { ...result, requested_url: requestedUrl }
      await writeCache(cache, canonical, acceptLanguage, withRequested, 'positive')
      return { kind: 'success', payload: withRequested, fromCache: false }
    }
  }

  const fallback = runFallback(canonical, requestedUrl)
  await writeCache(cache, canonical, acceptLanguage, fallback, 'negative')
  onStage?.({ stage: 'fallback', hit: true, durationMs: 0 })
  return { kind: 'success', payload: fallback, fromCache: false }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/pipeline.test.ts`

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/domain/pipeline.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/pipeline.test.ts
git commit -m "feat(metadata): add pipeline orchestrator (canonical→ssrf→cache→stages→fallback)"
```

---

## Phase D — Infra Adapters (2 tasks)

### Task 13: Redis cache adapter

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/infra/redisCache.ts`
- Create (extend): `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/cache.test.ts` _— add adapter tests_ (or create a separate `redisCache.test.ts`; below uses a separate file).
- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/redisCache.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/redisCache.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import { createRedisCache } from '../../infra/redisCache'
import type { StageResult } from '../../domain/types'

const fakeIoredis = () => {
  const store = new Map<string, string>()
  let lastSetArgs: { key: string; value: string; mode?: string; ttl?: number } | null = null
  return {
    store,
    lastSetArgs,
    get _last() {
      return lastSetArgs
    },
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, mode?: string, ttl?: number) => {
      store.set(key, value)
      lastSetArgs = { key, value, mode, ttl }
      return 'OK'
    }
  }
}

const sample: NonNullable<StageResult> = {
  success: true,
  url: 'https://example.com',
  requested_url: 'https://example.com',
  title: 'Example'
}

describe('createRedisCache', () => {
  test('returns a no-op adapter when redis is null', async () => {
    const cache = createRedisCache(null)
    expect(await cache.get('any')).toBeNull()
    await cache.set('any', sample, 60) // must not throw
  })

  test('get parses stored JSON; returns null on miss', async () => {
    const fake = fakeIoredis()
    fake.store.set('k', JSON.stringify(sample))
    const cache = createRedisCache(fake as any)
    expect(await cache.get('k')).toEqual(sample)
    expect(await cache.get('missing')).toBeNull()
  })

  test('get returns null when stored payload is corrupt', async () => {
    const fake = fakeIoredis()
    fake.store.set('k', 'not json')
    const cache = createRedisCache(fake as any)
    expect(await cache.get('k')).toBeNull()
  })

  test('set serializes JSON and uses EX TTL in seconds', async () => {
    const fake = fakeIoredis()
    const cache = createRedisCache(fake as any)
    await cache.set('k', sample, 1234)
    const last = fake._last!
    expect(last.key).toBe('k')
    expect(JSON.parse(last.value)).toEqual(sample)
    expect(last.mode).toBe('EX')
    expect(last.ttl).toBe(1234)
  })

  test('set swallows errors (cache is best-effort)', async () => {
    const fake = {
      get: async () => null,
      set: async () => {
        throw new Error('redis down')
      }
    }
    const cache = createRedisCache(fake as any)
    await cache.set('k', sample, 60) // must not throw
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/redisCache.test.ts`

Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement the adapter**

Write `packages/hocuspocus.server/src/modules/link-metadata/infra/redisCache.ts`:

```ts
import type { RedisClient } from '../../../types/redis.types'
import type { Cache, StageResult } from '../domain/types'

/**
 * Implements the `Cache` port using ioredis. Cache failures are logged
 * by ioredis itself; here they're swallowed so a Redis blip doesn't
 * break a metadata fetch (cache is best-effort by design).
 */
export const createRedisCache = (redis: RedisClient | null): Cache => {
  if (!redis) {
    return {
      get: async () => null,
      set: async () => {
        /* no-op when Redis is disabled */
      }
    }
  }

  return {
    get: async (key) => {
      try {
        const raw = await redis.get(key)
        if (!raw) return null
        return JSON.parse(raw) as StageResult
      } catch {
        return null
      }
    },
    set: async (key, value, ttlSeconds) => {
      try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      } catch {
        /* swallow — cache is best-effort */
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/redisCache.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/infra/redisCache.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/unit/redisCache.test.ts
git commit -m "feat(metadata): add ioredis Cache adapter (best-effort; null-safe)"
```

---

### Task 14: metascraper adapter

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/infra/metascraper.ts`

- [ ] **Step 1: Write the adapter**

Write `packages/hocuspocus.server/src/modules/link-metadata/infra/metascraper.ts`:

```ts
import metascraper from 'metascraper'
import author from 'metascraper-author'
import date from 'metascraper-date'
import description from 'metascraper-description'
import image from 'metascraper-image'
import lang from 'metascraper-lang'
import logo from 'metascraper-logo'
import publisher from 'metascraper-publisher'
import title from 'metascraper-title'
import url from 'metascraper-url'

import type { Scraper } from '../domain/types'

/**
 * Implements the `Scraper` port using metascraper + 9 plugins. The
 * instance is built once per `init()` call and held in closure (see
 * boundary rule 6: no module-level singletons).
 */
export const createMetascraper = (): Scraper => {
  const scraper = metascraper([
    title(),
    description(),
    image(),
    logo(),
    author(),
    publisher(),
    url(),
    date(),
    lang()
  ])

  return {
    scrape: async ({ html, url: pageUrl }) => {
      const meta = (await scraper({ html, url: pageUrl })) as Record<string, string | undefined>
      return {
        title: meta.title,
        description: meta.description,
        image: meta.image,
        logo: meta.logo,
        author: meta.author,
        publisher: meta.publisher,
        date: meta.date,
        lang: meta.lang,
        url: meta.url
      }
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/infra/metascraper.ts
git commit -m "feat(metadata): add metascraper Scraper adapter (9 plugins)"
```

---

## Phase E — HTTP Layer + Module Wiring (2 tasks)

### Task 15: HTTP layer (schema, controller, router)

**Files:**

- Create: `packages/hocuspocus.server/src/modules/link-metadata/http/schema.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/http/controller.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/http/router.ts`

- [ ] **Step 1: Write the schema**

Write `packages/hocuspocus.server/src/modules/link-metadata/http/schema.ts`:

```ts
import { z } from 'zod'

/**
 * Request wire contract. Treat as published API: additive changes only
 * within v1; breaking changes mint a new path.
 */
export const metadataQuerySchema = z.object({
  url: z.string().url('Invalid URL').max(2048, 'URL too long')
})

export type MetadataQuery = z.infer<typeof metadataQuerySchema>
```

- [ ] **Step 2: Write the controller**

Write `packages/hocuspocus.server/src/modules/link-metadata/http/controller.ts`:

```ts
import type { Context } from 'hono'
import type { Logger } from 'pino'

import { runPipeline, type PipelineStages } from '../domain/pipeline'
import type { Cache, ErrorResponse, MetadataResponse, Scraper } from '../domain/types'

export interface ControllerDeps {
  cache: Cache
  scraper: Scraper
  stages: PipelineStages
  logger: Logger
}

const POSITIVE_CACHE_HEADER = 'public, max-age=3600, stale-while-revalidate=86400'
const NEGATIVE_CACHE_HEADER = 'public, max-age=600'

export const createController = (deps: ControllerDeps) => {
  return async (c: Context): Promise<Response> => {
    const { url: requestedUrl } = c.req.valid('query' as never) as { url: string }
    const acceptLanguage = c.req.header('accept-language') ?? undefined
    const start = Date.now()

    const stageEvents: Array<{ stage: string; hit: boolean; durationMs: number }> = []
    const result = await runPipeline({
      requestedUrl,
      acceptLanguage,
      cache: deps.cache,
      scraper: deps.scraper,
      stages: deps.stages,
      onStage: (e) => stageEvents.push(e)
    })

    if (result.kind === 'error') {
      const body: ErrorResponse = {
        success: false,
        message: result.message,
        code: result.code
      }
      deps.logger.warn(
        { requested_url: requestedUrl, code: result.code, duration_ms: Date.now() - start },
        'metadata request rejected'
      )
      return c.json(body, result.status)
    }

    const response: MetadataResponse = {
      ...result.payload,
      cached: result.fromCache,
      fetched_at: new Date().toISOString()
    }

    const stagesPipelineStage =
      stageEvents.find((e) => e.hit)?.stage ?? (result.fromCache ? 'cache' : 'fallback')
    const isFallback = stagesPipelineStage === 'fallback'

    deps.logger.info(
      {
        requested_url: requestedUrl,
        canonical_url: response.url,
        host: safeHost(response.url),
        cache_hit: result.fromCache,
        pipeline_stage: stagesPipelineStage,
        duration_ms: Date.now() - start,
        stages: stageEvents
      },
      'metadata request completed'
    )

    c.header('Cache-Control', isFallback ? NEGATIVE_CACHE_HEADER : POSITIVE_CACHE_HEADER)
    c.header('Vary', 'Accept-Language')
    return c.json(response, 200)
  }
}

const safeHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
```

- [ ] **Step 3: Write the router**

Write `packages/hocuspocus.server/src/modules/link-metadata/http/router.ts`:

```ts
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import type { ControllerDeps } from './controller'
import { createController } from './controller'
import { metadataQuerySchema } from './schema'

export const createRouter = (deps: ControllerDeps): Hono => {
  const router = new Hono()
  router.get('/', zValidator('query', metadataQuerySchema), createController(deps))
  return router
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/http
git commit -m "feat(metadata): add HTTP layer (schema, controller, router)"
```

---

### Task 16: Module wiring + integration test

**Files:**

- Modify: `packages/hocuspocus.server/src/modules/link-metadata/module.ts`
- Create: `packages/hocuspocus.server/src/modules/link-metadata/__tests__/integration/http.test.ts`

- [ ] **Step 1: Replace `module.ts` with the real implementation**

Write `packages/hocuspocus.server/src/modules/link-metadata/module.ts`:

```ts
import type { Hono } from 'hono'
import type { Logger } from 'pino'

import type { RedisClient } from '../../types/redis.types'
import { runOembed } from './domain/stages/oembed'
import { runHtmlScrape } from './domain/stages/htmlScrape'
import { runSpecialHandler } from './domain/stages/handlers'
import { createRouter } from './http/router'
import { createMetascraper } from './infra/metascraper'
import { createRedisCache } from './infra/redisCache'

export interface InitDeps {
  redis: RedisClient | null
  logger: Logger
}

export interface InitResult {
  router: Hono
}

/**
 * Public wiring. Builds adapters, fixes pipeline stages in place, returns
 * a router the host can mount. No top-level side effects (boundary rule 6).
 */
export const init = (deps: InitDeps): InitResult => {
  const cache = createRedisCache(deps.redis)
  const scraper = createMetascraper()

  const stages = {
    oembed: runOembed,
    special: runSpecialHandler,
    html: runHtmlScrape
  }

  const router = createRouter({ cache, scraper, stages, logger: deps.logger })
  return { router }
}
```

- [ ] **Step 2: Write the integration test**

Write `packages/hocuspocus.server/src/modules/link-metadata/__tests__/integration/http.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import pino from 'pino'

import { init } from '../../module'

const silentLogger = pino({ level: 'silent' })

const makeMockRedis = () => {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    // ioredis signature: set(key, value, 'EX', ttlSeconds) — accept and ignore TTL args
    set: async (key: string, value: string, ..._rest: unknown[]) => {
      store.set(key, value)
      return 'OK'
    }
  } as any
}

const buildApp = () => {
  const { router } = init({ redis: makeMockRedis(), logger: silentLogger })
  const app = new Hono()
  app.route('/api/metadata', router)
  return app
}

describe('GET /api/metadata (integration)', () => {
  let fetchSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('returns 400 INVALID_URL for missing query param', async () => {
    const app = buildApp()
    const response = await app.request('http://localhost/api/metadata')
    expect(response.status).toBe(400)
  })

  test('returns 400 BLOCKED_URL for private IP', async () => {
    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('http://192.168.1.1')
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe('BLOCKED_URL')
  })

  test('returns 200 with rich payload on oEmbed hit', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'video',
          title: 'Test',
          provider_name: 'YouTube',
          html: '<iframe />'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=abc')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=3600')
    expect(response.headers.get('vary')).toBe('Accept-Language')
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.title).toBe('Test')
    expect(body.publisher.name).toBe('YouTube')
    expect(body.cached).toBe(false)
    expect(body.fetched_at).toBeDefined()
  })

  test('returns 200 with fallback when all stages fail', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }))

    const app = buildApp()
    const response = await app.request(
      'http://localhost/api/metadata?url=' + encodeURIComponent('https://random-blog.example.com')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=600')
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.title).toBe('random-blog.example.com')
  })

  test('second call serves from L3 cache', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ title: 'Cached', provider_name: 'YouTube' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    const app = buildApp()
    const url =
      'http://localhost/api/metadata?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=cached')

    const first = await app.request(url)
    expect((await first.json()).cached).toBe(false)

    const second = await app.request(url)
    const body = await second.json()
    expect(body.cached).toBe(true)
  })
})
```

- [ ] **Step 3: Run the integration test**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata/__tests__/integration/http.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 4: Run the full module test suite**

Run: `bun test packages/hocuspocus.server/src/modules/link-metadata`

Expected: PASS (all tests across unit + integration).

- [ ] **Step 5: Commit**

```bash
git add packages/hocuspocus.server/src/modules/link-metadata/module.ts \
  packages/hocuspocus.server/src/modules/link-metadata/__tests__/integration/http.test.ts
git commit -m "feat(metadata): wire init() and add end-to-end integration test"
```

---

## Phase F — Mount in Host (1 task)

### Task 17: Mount the router in `hocuspocus.server`

**Files:**

- Modify: `packages/hocuspocus.server/src/index.ts`

- [ ] **Step 1: Add the module import next to the existing router imports**

In `packages/hocuspocus.server/src/index.ts`, after the existing line `import hypermultimediaRouter from './api/hypermultimedia'` (currently line 7), add:

```ts
import * as linkMetadata from './modules/link-metadata'
```

- [ ] **Step 2: Add `logger` to the existing logger import**

The current import (line 9) is:

```ts
import { restApiLogger } from './lib/logger'
```

Change it to:

```ts
import { logger, restApiLogger } from './lib/logger'
```

- [ ] **Step 3: Mount the router alongside the other `/api/*` mounts**

Immediately after the existing `app.route('/api/admin', adminRouter)` line (currently line 49), add:

```ts
const linkMetadataModule = linkMetadata.init({
  redis: getRedisClient(),
  logger: logger.child({ module: 'link-metadata' })
})
app.route('/api/metadata', linkMetadataModule.router)
```

- [ ] **Step 4: Verify lint passes**

Run: `bun run --cwd packages/hocuspocus.server lint`

Expected: PASS.

- [ ] **Step 5: Smoke-start the server**

Run (in a separate terminal): `bun run --cwd packages/hocuspocus.server dev:rest`

Then in another terminal:

```bash
curl -i 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fexample.com'
```

Expected: HTTP/1.1 200, `cache-control` header present, JSON body with `title: "Example Domain"` (or fallback `example.com`), `cached: false`, `fetched_at: <ISO timestamp>`.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add packages/hocuspocus.server/src/index.ts
git commit -m "feat(metadata): mount link-metadata module at /api/metadata"
```

---

## Phase G — Webapp Cutover (3 tasks)

### Task 18: Rewrite client `fetchMetadata.ts`

**Files:**

- Modify: `packages/webapp/src/components/TipTap/hyperlinkPopovers/fetchMetadata.ts`

- [ ] **Step 1: Replace the file with the new client**

Write `packages/webapp/src/components/TipTap/hyperlinkPopovers/fetchMetadata.ts`:

```ts
import { normalizeHref } from '@docs.plus/extension-hyperlink'

/** Rich response shape returned by the new backend endpoint. */
export interface MetadataResponse {
  success: true
  url: string
  requested_url: string
  title: string
  description?: string
  lang?: string
  media_type?: 'website' | 'article' | 'video' | 'audio' | 'image' | 'profile' | 'document'
  author?: { name?: string; url?: string; avatar?: string }
  publisher?: { name?: string; url?: string; logo?: string; theme_color?: string }
  image?: { url: string; width?: number; height?: number; alt?: string }
  icon?: string
  favicon?: string
  oembed?: {
    type: 'video' | 'rich' | 'photo' | 'link'
    provider: string
    html?: string
    width?: number
    height?: number
    thumbnail?: string
  }
  published_at?: string
  modified_at?: string
  cached: boolean
  fetched_at: string
}

interface ErrorResponse {
  success: false
  message: string
  code: 'INVALID_URL' | 'BLOCKED_URL'
}

type ApiResponse = MetadataResponse | ErrorResponse

interface CacheEntry {
  data: MetadataResponse | null
  expiresAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const sessionCache = new Map<string, CacheEntry>()

const cacheKey = (href: string): string => normalizeHref(href)

export const getCachedMetadata = (href: string): MetadataResponse | null | undefined => {
  const entry = sessionCache.get(cacheKey(href))
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(cacheKey(href))
    return undefined
  }
  return entry.data
}

const setCachedMetadata = (href: string, data: MetadataResponse | null): void => {
  sessionCache.set(cacheKey(href), { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

const apiBaseUrl = (): string => {
  const base = process.env.NEXT_PUBLIC_RESTAPI_URL
  if (!base) throw new Error('NEXT_PUBLIC_RESTAPI_URL is not configured')
  return base
}

export interface FetchMetadataOptions {
  signal?: AbortSignal
}

/**
 * Hits the new GET /api/metadata endpoint on hocuspocus.server. The
 * backend never returns 5xx for upstream failures (always falls back to
 * a hostname+favicon shape), so non-ok responses here mean validation
 * (400) or rate-limit (429) — both cached as null to avoid hammering.
 */
export const fetchMetadata = async (
  href: string,
  { signal }: FetchMetadataOptions = {}
): Promise<MetadataResponse | null> => {
  const cached = getCachedMetadata(href)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(`${apiBaseUrl()}/metadata?url=${encodeURIComponent(href)}`, {
      method: 'GET',
      signal
    })

    if (!response.ok) {
      console.error('Metadata API error:', response.status, response.statusText)
      setCachedMetadata(href, null)
      return null
    }

    const data: ApiResponse = await response.json()
    if (data.success) {
      setCachedMetadata(href, data)
      return data
    }

    console.error('Metadata API error:', data.message)
    setCachedMetadata(href, null)
    return null
  } catch (error) {
    if (signal?.aborted) return null
    console.error('Error fetching metadata:', error)
    setCachedMetadata(href, null)
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit -p packages/webapp/tsconfig.json`

Expected: PASS — but **expect compile errors in `previewShared.ts` and `previewMobileSheet.ts`** because `image` changed from `string` to `{ url: string; … }`. Those are fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add packages/webapp/src/components/TipTap/hyperlinkPopovers/fetchMetadata.ts
git commit -m "feat(metadata): rewrite client to call new GET /api/metadata endpoint"
```

---

### Task 19: Update `previewShared.ts` for the rich shape

**Files:**

- Modify: `packages/webapp/src/components/TipTap/hyperlinkPopovers/previewShared.ts`
- Modify: `packages/webapp/src/styles/styles.scss`

- [ ] **Step 1: Update `createMetadataContent` and `safeWriteAttrs` to use the new shape**

In `packages/webapp/src/components/TipTap/hyperlinkPopovers/previewShared.ts`, replace `createMetadataContent` (the function spanning lines ~43-77 in the current file) with:

```ts
export const createMetadataContent = (data: MetadataResponse | null, href: string): HTMLElement => {
  const specialInfo = getSpecialUrlInfo(href)
  const container = createHTMLElement('div', {
    className: `metadata-content ${specialInfo ? 'metadata-content-special' : ''}`
  })

  const titleLink = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: data?.title || href,
    className: 'metadata-title'
  })
  titleLink.addEventListener('click', hrefEventHandler(href))
  container.append(titleLink)

  if (data?.publisher?.name || data?.author?.name) {
    const subtitle = createHTMLElement('div', {
      className: 'metadata-subtitle',
      textContent: [data.publisher?.name, data.author?.name].filter(Boolean).join(' · ')
    })
    container.append(subtitle)
  }

  if (data?.description) {
    const desc = createHTMLElement('div', {
      className: 'metadata-description',
      textContent: data.description
    })
    container.append(desc)
  }

  // Prefer the high-res icon → publisher logo → image thumbnail → special-icon SVG
  const imageUrl =
    data?.icon ||
    data?.publisher?.logo ||
    data?.image?.url ||
    data?.favicon ||
    data?.oembed?.thumbnail
  if (imageUrl) {
    const img = createHTMLElement('img', {
      src: imageUrl,
      alt: data?.image?.alt || data?.title || '',
      className: 'metadata-image',
      onerror: function (this: HTMLImageElement) {
        this.style.display = 'none'
      }
    })
    container.prepend(img)
  } else if (specialInfo) {
    container.prepend(
      createSvgIcon(specialInfo.icon, `metadata-icon-special icon-${specialInfo.category}`)
    )
  }

  return container
}
```

Then replace `safeWriteAttrs` (the function spanning lines ~92-104) with:

```ts
const safeWriteAttrs = (ctx: PreviewContext, data: MetadataResponse): void => {
  const { editor, nodePos, href } = ctx
  const node = editor.state.doc.nodeAt(nodePos)
  if (!node) return
  const stillHasMark = node.marks.some((m) => m.type.name === 'hyperlink' && m.attrs.href === href)
  if (!stillHasMark) return
  editor
    .chain()
    .setTextSelection(nodePos)
    .extendMarkRange('hyperlink')
    .updateAttributes('hyperlink', { title: data.title, image: data.image?.url })
    .run()
}
```

Also update the L1-cache-hit branch in `renderMetadataInto` (currently at lines ~119-127) — when reading existingImage from mark attrs (a string) we need to wrap it:

```ts
const existingTitle = typeof attrs?.title === 'string' ? attrs.title : undefined
const existingImage = typeof attrs?.image === 'string' ? attrs.image : undefined
if (existingTitle) {
  container.replaceChildren(
    createMetadataContent(
      {
        success: true,
        url: href,
        requested_url: href,
        title: existingTitle,
        image: existingImage ? { url: existingImage } : undefined,
        cached: true,
        fetched_at: new Date(0).toISOString()
      },
      href
    )
  )
  return
}
```

- [ ] **Step 2: Add CSS for the new subtitle and description rows**

In `packages/webapp/src/styles/styles.scss`, locate the `.metadata-content` block (search for `.metadata-content`) and add the following sibling rules just below it:

```scss
.metadata-subtitle {
  font-size: 12px;
  color: var(--color-text-muted, #6b7280);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metadata-description {
  font-size: 12px;
  color: var(--color-text-secondary, #4b5563);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bunx tsc --noEmit -p packages/webapp/tsconfig.json`

Expected: PASS (no errors in TipTap hyperlink popover files).

- [ ] **Step 4: Commit**

```bash
git add packages/webapp/src/components/TipTap/hyperlinkPopovers/previewShared.ts \
  packages/webapp/src/styles/styles.scss
git commit -m "feat(metadata): render publisher/author/description in preview popover"
```

---

### Task 20: Delete the Next.js endpoint and webapp deps

**Files:**

- Delete: `packages/webapp/src/pages/api/metadata.ts`
- Modify: `packages/webapp/package.json`

- [ ] **Step 1: Delete the old endpoint**

Delete the file `packages/webapp/src/pages/api/metadata.ts`.

- [ ] **Step 2: Remove `cheerio` and `open-graph-scraper` from `packages/webapp/package.json`**

In `packages/webapp/package.json`, remove these two lines from `dependencies`:

```json
"cheerio": "^1.2.0",
"open-graph-scraper": "^6.11.0",
```

- [ ] **Step 3: Reinstall to update the lockfile**

Run: `bun install`

Expected: lockfile updates; both packages disappear from the lockfile resolution for `webapp`.

- [ ] **Step 4: Verify nothing else in webapp imports them**

Run:

```bash
rg --type ts --type tsx 'cheerio|open-graph-scraper' packages/webapp/src
```

Expected: no matches.

- [ ] **Step 5: Verify webapp typechecks**

Run: `bunx tsc --noEmit -p packages/webapp/tsconfig.json`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/webapp/package.json packages/webapp/src/pages/api/metadata.ts bun.lock
git commit -m "chore(metadata): delete old Next.js endpoint and unused deps"
```

---

## Phase H — Verification (1 task)

### Task 21: Manual smoke test on representative URLs

**Files:** None (verification only).

- [ ] **Step 1: Start the backend and the webapp**

Terminal 1: `bun run --cwd packages/hocuspocus.server dev:rest`
Terminal 2: `bun run --cwd packages/webapp dev`

Expected: both start cleanly. No errors in either log.

- [ ] **Step 2: Hit the endpoint directly with curl for each representative URL**

Run each command below. Expected: HTTP 200, `success: true`, `title` reasonable, log line in the backend terminal showing `pipeline_stage`, `cache_hit`, `host`, `duration_ms`.

```bash
# oEmbed (YouTube)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ' | jq '.title, .publisher.name, .oembed.html | tostring | length'

# Special handler (GitHub repo)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fgithub.com%2Fhonojs%2Fhono' | jq '.title, .publisher.name, .description'

# Special handler (Wikipedia)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FRich_Hickey' | jq '.title, .description'

# HTML scrape (general blog or news site)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fblog.cloudflare.com' | jq '.title, .publisher.name'

# Hostile-to-bot site (X — falls through oEmbed → fallback typically; just confirm 200)
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fx.com%2Fhono_js'

# Broken URL (DNS failure → fallback)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fdoes-not-exist-12345.example.com' | jq '.title, .cached'

# Invalid URL (validation → 400)
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4000/api/metadata?url=not-a-url'
# Expected: 400

# Private IP (SSRF block → 400)
curl -s 'http://localhost:4000/api/metadata?url=http%3A%2F%2F192.168.1.1' | jq '.code'
# Expected: "BLOCKED_URL"

# Cache hit (run a positive URL twice; second response should have cached: true)
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fgithub.com%2Fhonojs%2Fhono' > /dev/null
curl -s 'http://localhost:4000/api/metadata?url=https%3A%2F%2Fgithub.com%2Fhonojs%2Fhono' | jq '.cached'
# Expected: true
```

- [ ] **Step 3: Smoke the webapp UI**

Open the webapp at `http://localhost:3000` (or whatever the dev port is), open a doc, paste each of the above URLs into the editor, and hover over each link.

Expected:

- Loading skeleton appears immediately.
- Card renders with title; publisher and description appear when present (GitHub repo, Wikipedia article).
- For broken URL, card renders with hostname (graceful degradation, no error chrome).
- On mobile viewport (Chrome DevTools), tapping a link opens the bottom sheet with the same metadata.
- Network tab shows GET requests to `${NEXT_PUBLIC_RESTAPI_URL}/metadata?url=...` (not POST to `/api/metadata`).

- [ ] **Step 4: Commit a verification note**

There's nothing to commit — verification is observational. If you found issues, fix them with focused commits using the existing commit message style (`fix(metadata): …`).

---

## Self-Review Checklist (run after writing every task; performed inline below)

**Spec coverage** (every section of the spec → at least one task):

- Endpoint shape (GET, query, status codes) → Tasks 15, 16
- Pipeline order + fall-through + per-stage timeouts → Tasks 9–12
- Response shape (rich `MetadataResponse`) → Tasks 2 (types), 9–11 (stage normalization), 16 (controller adds `cached`/`fetched_at`)
- HTML fetch hardening (UA, charset, content-type gate, base URL, body cap) → Task 11
- oEmbed registry (11 providers) → Task 9
- Special handlers (GitHub, Wikipedia, Reddit) → Task 10
- Scraping library (metascraper + 9 plugins) → Tasks 4 (deps), 14 (adapter)
- Caching (Redis L3 with sha1+lang key, positive/negative TTLs, HTTP `Cache-Control`) → Tasks 8 (key+stage), 13 (adapter), 16 (controller headers)
- Security (SSRF guard, existing global rate limit) → Task 6 (SSRF). Rate limit is already in place in `middleware/index.ts` — no change required.
- Observability (per-stage Pino logs with `pipeline_stage`, `cache_hit`, `host`, `duration_ms`) → Task 16 (controller logs)
- Extraction readiness (7 boundary rules) → Tasks 1 (README + structure), 2 (inline ports), 3 (ESLint enforcement), 16 (init wiring)
- Code Layout (every file in the spec's tree) → covered across all tasks; cross-checked file list at top of plan
- Cutover Plan (delete Next.js endpoint, remove deps, update webapp client and shared renderer) → Tasks 18, 19, 20

**Placeholder scan:** none of "TBD", "implement later", "appropriate error handling", "similar to Task N" patterns present. Every step has either complete code or an exact command + expected output.

**Type consistency:** spot-checked.

- `Cache.set(key, value, ttlSeconds)` in `domain/types.ts` (Task 2) matches the call sites in `domain/stages/cache.ts` (Task 8), `infra/redisCache.ts` (Task 13), and the integration test (Task 16).
- `Scraper.scrape({ html, url })` in `domain/types.ts` (Task 2) matches the call site in `domain/stages/htmlScrape.ts` (Task 11) and the implementation in `infra/metascraper.ts` (Task 14).
- `runFallback(canonicalUrl, requestedUrl?)` (Task 7) is called from `domain/pipeline.ts` (Task 12) with both args present.
- `runPipeline` returns `{ kind: 'success' | 'error' }` (Task 12) and is consumed by the controller (Task 15) with that exact discriminated-union shape.
- `MetadataResponse.image` is `{ url: string; … }` everywhere (Task 2 → Task 18 client → Task 19 renderer).

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-16-link-metadata-service-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
