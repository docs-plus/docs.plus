# Extension-Hyperlink 2.0 — PR 1: Safety + Parity Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the security policy, Tiptap-Link option parity, plugin correctness fixes, packaging hygiene, and a CI workflow that gates the package on every PR — without changing the public command shape (that's PR 2).

**Architecture:** A single `isSafeHyperlinkHref()` function inside `src/utils/validateURL.ts` becomes the only place that decides whether an `href` may be written. Every existing write site (`parseHTML`, `renderHTML`, `setHyperlink`, `markPasteRule`, `pasteHandler`, `autolink`, `clickHandler`, preview popover) is rewired to call it. The current `setHyperlink({ href })` shape is preserved so the webapp doesn't break — the API refactor lands in PR 2.

**Tech Stack:** Tiptap 3 / ProseMirror, Bun ≥1.3 (test runner + bundler runtime), tsup (build), Cypress + Bun unit tests, ESLint flat config, `linkifyjs` (peer), `@floating-ui/dom` (dep).

**Spec:** `/Users/macbook/workspace/docsy/docs/superpowers/specs/2026-04-21-extension-hyperlink-2.0-design.md`

**Worktree:** `../docsy-extension-hyperlink-2.0` on branch `feat/extension-hyperlink-2.0` (created in Task 0).

---

## Task 0: Bootstrap worktree and dev environment

**Files:**

- Create: worktree at `/Users/macbook/workspace/docsy-extension-hyperlink-2.0`
- Create: `packages/extension-hyperlink/bunfig.toml`
- Modify: `packages/extension-hyperlink/package.json`

- [ ] **Step 1: Create the worktree from clean main**

```bash
cd /Users/macbook/workspace/docsy
git fetch origin
git worktree add ../docsy-extension-hyperlink-2.0 -b feat/extension-hyperlink-2.0 origin/main
cd ../docsy-extension-hyperlink-2.0
```

Expected: new directory created, branch is `feat/extension-hyperlink-2.0`.

- [ ] **Step 2: Install workspace dependencies in the worktree**

```bash
bun install --frozen-lockfile
```

Expected: `node_modules` populated. The lockfile is consistent with `main`'s `package.json` so `--frozen-lockfile` succeeds. Subsequent tasks that change deps (Task 1, Task 2 of PR 1) will use plain `bun install`.

- [ ] **Step 3: Add `cypress-axe` and `publint` as devDependencies**

```bash
cd packages/extension-hyperlink
bun add -d cypress-axe@^1.6.0 publint@^0.3.0
```

Expected: both appear under `devDependencies` in `packages/extension-hyperlink/package.json`. Lockfile updates.

- [ ] **Step 4: Create `bunfig.toml` with coverage settings**

Create `packages/extension-hyperlink/bunfig.toml`:

```toml
[test]
coverage = true
coverageReporter = ["text", "lcov"]
coverageDir = "coverage"

# Single workspace-wide line-coverage gate. Per-path enforcement is
# unnecessary because the highest-risk paths (URL safety, paste, autolink)
# are pinned by table-driven E2E specs (xss-guards, paste-policy) that
# fail loudly before this threshold is even consulted.
coverageThreshold = { line = 0.85 }

coveragePathIgnorePatterns = [
  "**/__tests__/**",
  "**/test/**",
  "**/scripts/**",
  "**/dist/**",
  "**/cypress/**",
]
```

- [ ] **Step 5: Verify Bun runs unit tests with coverage**

```bash
cd packages/extension-hyperlink
bun test src/utils/__tests__
```

Expected: all existing unit tests pass and a coverage table prints. If any test fails, stop — it's a pre-existing issue and must be reported.

- [ ] **Step 6: Commit**

```bash
git add packages/extension-hyperlink/package.json packages/extension-hyperlink/bunfig.toml bun.lock
git commit -m "chore(extension-hyperlink): bootstrap 2.0 worktree

- Add publint (used by PR 1 Task 14) and cypress-axe (used by PR 2 Task 7) as devDependencies.
- Add bunfig.toml with single workspace line-coverage threshold (0.85)
  plus path-ignore patterns. Security paths are pinned by E2E
  attack-vector tests; per-path coverage thresholds would be
  bookkeeping without additional safety."
```

---

## Task 1: Pin bun-types and restructure deps (M7, M8)

**Files:**

- Modify: `package.json` (root — add `bun-types` to the catalog)
- Modify: `packages/extension-hyperlink/package.json`
- Modify: `packages/webapp/package.json`

- [ ] **Step 1: Add `bun-types` to the workspace catalog**

The root `package.json` `catalog` block (verified by reading `package.json:115`) does **not** currently contain `bun-types` — it lives only in root `devDependencies` (`package.json:83`). Pinning the package to `"catalog:"` without the catalog entry would fail `bun install` with "no matching catalog entry for bun-types".

Edit `package.json` and add to the `catalog` block (preserving the existing alphabetical-within-group ordering — slot near `cypress` / `cypress-real-events`):

```json
"bun-types": "^1.3.11",
```

The literal version must match what's already in root `devDependencies` so installed versions stay identical.

- [ ] **Step 2: Update `packages/extension-hyperlink/package.json`**

Three coordinated changes (current state for reference: `linkifyjs ^4.3.2` is currently in `dependencies`; `bun-types` is `"latest"` in `devDependencies`):

1. Pin `devDependencies["bun-types"]` from `"latest"` → `"catalog:"` (now resolvable thanks to Step 1).
2. Remove `linkifyjs` from `dependencies`.
3. Add a new `peerDependencies` entry for `linkifyjs` and add it back as a `devDependency` so the package's own self-tests and build still resolve it.

Final shape (only the changed fields shown):

```json
{
  "dependencies": {
    "@floating-ui/dom": "^1.7.6"
  },
  "peerDependencies": {
    "@tiptap/core": "catalog:",
    "@tiptap/pm": "catalog:",
    "linkifyjs": "^4.3.2"
  },
  "peerDependenciesMeta": {
    "linkifyjs": { "optional": false }
  },
  "devDependencies": {
    "bun-types": "catalog:",
    "linkifyjs": "^4.3.2"
  }
}
```

- [ ] **Step 3: Add `linkifyjs` to the webapp's dependencies**

Edit `packages/webapp/package.json` and add to `dependencies` (preserving alphabetical order):

```json
"linkifyjs": "^4.3.2"
```

This unblocks the webapp consumer once `linkifyjs` becomes peer.

- [ ] **Step 4: Refresh the lockfile**

```bash
bun install
```

Expected: lockfile updates, no install errors.

- [ ] **Step 5: Verify build still works**

```bash
bun run --filter @docs.plus/extension-hyperlink build
```

Expected: `dist/` is regenerated, no warnings about missing `linkifyjs`.

- [ ] **Step 6: Commit**

```bash
git add package.json packages/extension-hyperlink/package.json packages/webapp/package.json bun.lock
git commit -m "chore(extension-hyperlink): pin bun-types, peer linkifyjs (M7, M8)

- Add bun-types to the workspace catalog (root package.json) so the
  extension can pin to 'catalog:' like every other shared dev dep.
- bun-types: 'latest' was a CI footgun; pin to catalog: like the rest
  of the workspace.
- linkifyjs is moved from dependencies to peerDependencies so apps can
  dedupe (Tiptap-Link follows the same pattern). Webapp's own
  dependencies list adds linkifyjs explicitly."
```

---

## Task 2: Fix README documenting a non-exported helper (B5)

**Files:**

- Modify: `packages/extension-hyperlink/README.md`

- [ ] **Step 1: Locate and remove the `normalizeLinkifyHref` documentation**

Search for the row mentioning `normalizeLinkifyHref(m)` (around README:303-308) and delete it from the helpers table. The function stays internal — keep `src/utils/index.ts` unchanged for now.

- [ ] **Step 2: Verify only the documented row was removed**

```bash
rg 'normalizeLinkifyHref' packages/extension-hyperlink/README.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add packages/extension-hyperlink/README.md
git commit -m "docs(extension-hyperlink): drop normalizeLinkifyHref from public API table (B5)

The helper is not exported from src/utils/index.ts — README was
contradicting the actual public surface. Removing the row keeps the
documented API honest."
```

---

## Task 3: Platform-aware Mod-key Cypress helper (M11)

> **Note:** The ESLint seam rule (S1 / spec §3.2) was originally Task 3 of this PR. It moved to PR 2 Task 5 because PR 1 keeps the click handler still importing `helpers/floatingToolbar`, and shipping the rule here would mean adding then immediately suppressing it — code-debt by design. PR 2's clickHandler refactor removes the import and lands the rule in one commit.

**Files:**

- Create: `packages/extension-hyperlink/cypress/support/keyboard.ts`
- Modify: `packages/extension-hyperlink/cypress/support/e2e.ts`
- Modify: `packages/extension-hyperlink/cypress/e2e/create.cy.ts` (and any other spec using hard-coded `'Meta'`)

- [ ] **Step 1: Find current usages**

```bash
rg "realPress\(\['Meta'" packages/extension-hyperlink/cypress
rg "realPress\('Meta'" packages/extension-hyperlink/cypress
```

Capture the list — these are all the call sites that need migration.

- [ ] **Step 2: Create the helper**

Create `packages/extension-hyperlink/cypress/support/keyboard.ts`:

```ts
/**
 * Cross-platform Mod key for keyboard shortcut tests. Resolves to
 * 'Meta' on macOS (Cmd) and 'Control' on Linux/Windows. Cypress
 * exposes the runner OS via Cypress.platform.
 */
export const ModKey = (): 'Meta' | 'Control' => (Cypress.platform === 'darwin' ? 'Meta' : 'Control')

/**
 * Press Mod+<key> via cypress-real-events. Use instead of hard-coded
 * `cy.realPress(['Meta', 'K'])` so tests pass on every CI OS.
 *
 * @example
 *   pressMod('K') // Mod+K
 *   pressMod('Z') // undo
 *   pressMod(['Shift', 'Z']) // redo
 */
export const pressMod = (key: string | string[]): void => {
  const keys = Array.isArray(key) ? key : [key]
  cy.realPress([ModKey(), ...keys])
}
```

- [ ] **Step 3: Wire the helper into the support file**

Add to `packages/extension-hyperlink/cypress/support/e2e.ts` (top of file with other imports):

```ts
import './keyboard'
```

This is a no-op unless something later imports `keyboard` directly — it primarily ensures TypeScript picks the file up.

- [ ] **Step 4: Migrate all existing call sites**

For each file from Step 1, replace:

```ts
cy.realPress(['Meta', 'K'])
```

with:

```ts
import { pressMod } from '../support/keyboard'
// ...
pressMod('K')
```

If a spec already imports from `../support/...` keep that import together.

- [ ] **Step 5: Run the existing E2E suite headlessly**

```bash
cd packages/extension-hyperlink
bun run test:e2e
```

Expected: all existing specs pass (you're on macOS so behavior is unchanged; on Linux CI the change becomes load-bearing). If a spec fails, the migration was incomplete.

- [ ] **Step 6: Commit**

```bash
git add packages/extension-hyperlink/cypress
git commit -m "test(extension-hyperlink): add platform-aware Mod key helper (M11)

cypress/support/keyboard.ts exports pressMod(key) which resolves to
Meta on macOS and Control on Linux/Windows. All existing call sites
of cy.realPress(['Meta', ...]) migrate to the helper so tests pass
on every CI runner OS, not just developer Macs."
```

---

## Task 4: Build `isSafeHyperlinkHref` with TDD (B1, M1)

**Files:**

- Create: `packages/extension-hyperlink/src/utils/__tests__/isSafeHyperlinkHref.test.ts`
- Modify: `packages/extension-hyperlink/src/utils/validateURL.ts`
- Modify: `packages/extension-hyperlink/src/utils/index.ts`

This is the most important task in the PR. We TDD it carefully.

- [ ] **Step 1: Write the failing test file**

Create `packages/extension-hyperlink/src/utils/__tests__/isSafeHyperlinkHref.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import { isSafeHyperlinkHref } from '../validateURL'

const defaultCtx = {
  defaultProtocol: 'https',
  protocols: [] as Array<string | { scheme: string; optionalSlashes?: boolean }>
}

describe('isSafeHyperlinkHref — denylist', () => {
  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)', // case-insensitive
    '  javascript:alert(1)', // leading whitespace
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg/onload=alert(1)>',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'blob:https://evil.com/abc-123',
    'about:blank',
    'chrome://settings',
    'view-source:https://evil.com'
  ])('rejects %s', (href) => {
    expect(isSafeHyperlinkHref(href, defaultCtx)).toBe(false)
  })
})

describe('isSafeHyperlinkHref — allowlist', () => {
  test.each([
    'https://example.com',
    'http://example.com/path?q=1#hash',
    'mailto:user@example.com',
    'mailto:a@b.com,c@d.com?subject=hi',
    'tel:+15551234567',
    'sms:+15551234567',
    'ftp://files.example.com',
    'ftps://files.example.com',
    'geo:37.786971,-122.399677'
  ])('accepts %s', (href) => {
    expect(isSafeHyperlinkHref(href, defaultCtx)).toBe(true)
  })
})

describe('isSafeHyperlinkHref — special-scheme catalog', () => {
  test('accepts whatsapp:// (registered in specialUrls catalog)', () => {
    expect(isSafeHyperlinkHref('whatsapp://send?text=hi', defaultCtx)).toBe(true)
  })

  test('accepts wa.me/* (catalog domain pattern)', () => {
    expect(isSafeHyperlinkHref('https://wa.me/15551234567', defaultCtx)).toBe(true)
  })
})

describe('isSafeHyperlinkHref — custom protocols', () => {
  test('accepts a scheme listed in ctx.protocols (string form)', () => {
    expect(
      isSafeHyperlinkHref('myapp://open?id=42', {
        ...defaultCtx,
        protocols: ['myapp']
      })
    ).toBe(true)
  })

  test('accepts a scheme listed in ctx.protocols (object form)', () => {
    expect(
      isSafeHyperlinkHref('myapp://open', {
        ...defaultCtx,
        protocols: [{ scheme: 'myapp', optionalSlashes: true }]
      })
    ).toBe(true)
  })

  test('still rejects denylisted scheme even if user adds it to protocols', () => {
    // Denylist wins over custom protocols — this is a security
    // invariant; consumers can override only via isAllowedUri.
    expect(
      isSafeHyperlinkHref('javascript:alert(1)', {
        ...defaultCtx,
        protocols: ['javascript']
      })
    ).toBe(false)
  })
})

describe('isSafeHyperlinkHref — isAllowedUri precedence', () => {
  test('isAllowedUri can reject what built-in policy would accept', () => {
    expect(
      isSafeHyperlinkHref('https://example.com', {
        ...defaultCtx,
        isAllowedUri: () => false
      })
    ).toBe(false)
  })

  test('isAllowedUri can accept what built-in policy would reject', () => {
    // Consumer takes responsibility for safety when they override.
    expect(
      isSafeHyperlinkHref('about:blank', {
        ...defaultCtx,
        isAllowedUri: () => true
      })
    ).toBe(true)
  })

  test('isAllowedUri receives the href and ctx with defaultProtocol/protocols', () => {
    let received: { href?: string; ctx?: unknown } = {}
    isSafeHyperlinkHref('https://example.com', {
      ...defaultCtx,
      isAllowedUri: (href, ctx) => {
        received = { href, ctx }
        return true
      }
    })
    expect(received.href).toBe('https://example.com')
    expect(received.ctx).toMatchObject({ defaultProtocol: 'https', protocols: [] })
  })
})

describe('isSafeHyperlinkHref — edge cases', () => {
  test('rejects empty string', () => {
    expect(isSafeHyperlinkHref('', defaultCtx)).toBe(false)
  })

  test('rejects whitespace-only string', () => {
    expect(isSafeHyperlinkHref('   ', defaultCtx)).toBe(false)
  })

  test('rejects URLs with embedded credentials by default', () => {
    // user:pass@host is a phishing vector; reject unless caller explicitly opts in via isAllowedUri.
    expect(isSafeHyperlinkHref('https://user:pass@evil.com', defaultCtx)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/extension-hyperlink
bun test src/utils/__tests__/isSafeHyperlinkHref.test.ts
```

Expected: import failure — `isSafeHyperlinkHref` is not yet defined.

- [ ] **Step 3: Write the minimal implementation**

Modify `packages/extension-hyperlink/src/utils/validateURL.ts`. Append the new function and types **without** removing existing exports:

```ts
import { getSpecialUrlInfo } from './specialUrls'

/**
 * Schemes that are always rejected as hyperlink hrefs. Includes XSS
 * vectors (javascript/data/vbscript) and local/system schemes that
 * leak ambient authority (file/blob/about/chrome/view-source).
 *
 * Note: this is a strict expansion of the original DANGEROUS_SCHEME_RE
 * which only covered the first three. The expansion is the point of B1.
 */
export const DANGEROUS_SCHEME_RE =
  /^\s*(javascript|data|vbscript|file|blob|about|chrome|view-source):/i

const SAFE_BUILTIN_SCHEMES = new Set([
  'http',
  'https',
  'mailto',
  'tel',
  'sms',
  'ftp',
  'ftps',
  'geo'
])

export type ProtocolConfig = string | { scheme: string; optionalSlashes?: boolean }

export type IsSafeHyperlinkHrefContext = {
  defaultProtocol: string
  protocols: ProtocolConfig[]
  isAllowedUri?: (href: string, ctx: IsSafeHyperlinkHrefContext) => boolean
}

const protocolToScheme = (p: ProtocolConfig): string =>
  typeof p === 'string' ? p.toLowerCase() : p.scheme.toLowerCase()

/**
 * Decide whether `href` is allowed to be written into a hyperlink mark.
 *
 * Precedence (per spec §3.4):
 *   1. Denylist (always wins; cannot be overridden by `protocols`).
 *   2. `isAllowedUri(href, ctx)` — if defined, its boolean is final.
 *   3. Built-in allowlist (web schemes + special-scheme catalog).
 *   4. Custom `protocols` registered via the option.
 *
 * The `validate` legacy hook (per spec §3.4) runs at call sites
 * AFTER this function returns true; it is not consulted here.
 */
export const isSafeHyperlinkHref = (href: string, ctx: IsSafeHyperlinkHrefContext): boolean => {
  if (!href || !href.trim()) return false

  // Denylist — strictest. Wins over isAllowedUri only when isAllowedUri is
  // not defined; an explicit isAllowedUri can still accept (consumer
  // takes responsibility).
  const isDenylisted = DANGEROUS_SCHEME_RE.test(href)

  if (ctx.isAllowedUri) {
    return ctx.isAllowedUri(href, ctx)
  }

  if (isDenylisted) return false

  const scheme = getUrlScheme(href)
  if (!scheme) {
    // No scheme — reject; setHyperlink callers are expected to
    // normalize via normalizeHref before calling, which prepends
    // defaultProtocol.
    return false
  }

  if (SAFE_BUILTIN_SCHEMES.has(scheme)) {
    // Reject embedded credentials by default for web schemes.
    if (scheme === 'http' || scheme === 'https' || scheme === 'ftp' || scheme === 'ftps') {
      try {
        const u = new URL(href)
        if (u.username || u.password) return false
      } catch {
        return false
      }
    }
    return true
  }

  // Special-scheme catalog (whatsapp:, wa.me/*, etc.) — already
  // exposed via getSpecialUrlInfo.
  if (getSpecialUrlInfo(href)) return true

  // Custom-registered protocols.
  if (ctx.protocols.some((p) => protocolToScheme(p) === scheme)) return true

  return false
}
```

The existing `validateURL` and `getUrlScheme` functions remain in the file unchanged — `isSafeHyperlinkHref` is the new safety boundary; `validateURL` keeps its existing role as the "looks like a URL?" check used inside `autolink.ts`.

- [ ] **Step 4: Re-export from the utils barrel**

Modify `packages/extension-hyperlink/src/utils/index.ts` to export the new function and types:

```ts
export {
  DANGEROUS_SCHEME_RE,
  isSafeHyperlinkHref,
  validateURL,
  type IsSafeHyperlinkHrefContext,
  type ProtocolConfig
} from './validateURL'
// ... existing exports preserved
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun test src/utils/__tests__/isSafeHyperlinkHref.test.ts
```

Expected: all tests green. If `getSpecialUrlInfo` semantics differ from what the catalog test expects, fix the test (the catalog is the source of truth) — not the implementation.

- [ ] **Step 6: Run the full unit suite**

```bash
bun test src
```

Expected: all tests still pass; `validateURL.test.ts` should be unaffected because we only added the new export.

- [ ] **Step 7: Commit**

```bash
git add packages/extension-hyperlink/src/utils/validateURL.ts \
        packages/extension-hyperlink/src/utils/__tests__/isSafeHyperlinkHref.test.ts \
        packages/extension-hyperlink/src/utils/index.ts
git commit -m "feat(extension-hyperlink): add isSafeHyperlinkHref URL policy (B1)

Single source of truth for whether an href is safe to store as a
hyperlink mark. Implements the precedence ladder from spec §3.4:

  1. Denylist (javascript, data, vbscript, file, blob, about,
     chrome, view-source) — always wins unless isAllowedUri overrides.
  2. isAllowedUri callback — if defined, its boolean is final.
  3. Built-in allowlist (http, https, mailto, tel, sms, ftp, ftps, geo).
  4. Special-scheme catalog (whatsapp:, wa.me/*, etc.).
  5. Custom protocols registered via options.protocols.

Embedded credentials (user:pass@host) are rejected for web schemes.

Existing DANGEROUS_SCHEME_RE expanded from 3 to 8 schemes. Existing
validateURL kept untouched for now — it has a different job (URL
shape detection for autolink); next tasks rewire callers."
```

---

## Task 5: Add new `HyperlinkOptions` (M1)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`

- [ ] **Step 1: Extend the `HyperlinkOptions` interface**

Modify `packages/extension-hyperlink/src/hyperlink.ts`. Replace the `HyperlinkOptions` interface (currently lines 48-59) with:

```ts
import type { IsSafeHyperlinkHrefContext, ProtocolConfig } from './utils/validateURL'

export interface HyperlinkOptions {
  /** Auto-link URLs as the user types. */
  autolink: boolean

  /** Custom protocols to register with linkifyjs. */
  protocols: ProtocolConfig[]

  /** Open links on click (in non-editable view; popover handles editable). */
  openOnClick: boolean

  /** Linkify pasted URLs that match a non-empty selection. */
  linkOnPaste: boolean

  HTMLAttributes: Partial<HyperlinkAttributes>

  popovers: {
    previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement | null) | null
    createHyperlink?: ((options: CreateHyperlinkOptions) => HTMLElement | null) | null
  }

  /**
   * Legacy validate hook. Runs AFTER the safety layer (isAllowedUri /
   * isSafeHyperlinkHref) accepts; can additionally reject on business
   * rules. Cannot accept what the safety layer rejected.
   */
  validate?: (url: string) => boolean

  /**
   * Default protocol for normalize / safety checks. Defaults to 'https'.
   * Used when normalizing bare-domain hrefs (`example.com` → `https://example.com`).
   */
  defaultProtocol: string

  /**
   * Override the entire URL-policy decision. If defined, its return
   * value is final — built-in denylist/allowlist are bypassed.
   * Highest precedence (see spec §3.4).
   */
  isAllowedUri?: (href: string, ctx: IsSafeHyperlinkHrefContext) => boolean

  /**
   * Whether to extend selection through the link mark on click.
   * Mirrors @tiptap/extension-link behavior. Default false.
   */
  enableClickSelection: boolean

  /**
   * Per-candidate gate for the autolink plugin. Return false to
   * suppress the link. Runs BEFORE isSafeHyperlinkHref.
   * Default returns true.
   */
  shouldAutoLink: (url: string) => boolean
}
```

- [ ] **Step 2: Update `addOptions()` to provide defaults**

Replace the existing `addOptions()` (currently lines 103-120) with:

```ts
addOptions() {
  return {
    openOnClick: true,
    linkOnPaste: true,
    autolink: true,
    protocols: [],
    HTMLAttributes: {
      target: null,
      rel: 'noopener noreferrer nofollow',
      class: null
    },
    popovers: {
      previewHyperlink: null,
      createHyperlink: null
    },
    validate: undefined,
    defaultProtocol: 'https',
    isAllowedUri: undefined,
    enableClickSelection: false,
    shouldAutoLink: () => true
  }
},
```

- [ ] **Step 3: Build to verify the types compile**

```bash
bun run --filter @docs.plus/extension-hyperlink build
```

Expected: clean build. If the existing test/playground or webapp consumer fails to compile because of the new required options, those defaults from `addOptions()` should cover them — the consumer doesn't need to pass them.

- [ ] **Step 4: Run unit tests**

```bash
bun test src
```

Expected: still green.

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): add Tiptap-Link parity options (M1)

New HyperlinkOptions:
- defaultProtocol (default 'https')
- isAllowedUri (override URL policy, highest precedence)
- enableClickSelection (default false)
- shouldAutoLink (default returns true)

protocols typing tightened to ProtocolConfig (re-exported from
validateURL). validate stays as the legacy escape hatch — its
precedence relative to isAllowedUri/isSafeHyperlinkHref is documented
in the JSDoc and enforced by call-site order in subsequent tasks."
```

---

## Task 6: Wire `isSafeHyperlinkHref` into `hyperlink.ts` (B1)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`

This task threads the policy function through `parseHTML.getAttrs`, `renderHTML`, `setHyperlink`, the input rule, and `markPasteRule`. It does **not** change the public command shape — `setHyperlink` still opens a popover when configured. PR 2 splits that.

- [ ] **Step 1: Add a small helper at the top of the file**

After the existing imports, add:

```ts
import { isSafeHyperlinkHref, type IsSafeHyperlinkHrefContext } from './utils/validateURL'

/** Build the IsSafeHyperlinkHrefContext from current options. */
const policyCtx = (options: HyperlinkOptions): IsSafeHyperlinkHrefContext => ({
  defaultProtocol: options.defaultProtocol,
  protocols: options.protocols,
  isAllowedUri: options.isAllowedUri
})
```

- [ ] **Step 2: Tighten `parseHTML.getAttrs`**

Replace the existing `parseHTML()` (currently lines 146-161) with:

```ts
parseHTML() {
  return [
    {
      tag: 'a[href]',
      getAttrs: (node: HTMLElement | string) => {
        if (typeof node === 'string') return false
        const href = node.getAttribute('href') ?? ''
        return isSafeHyperlinkHref(href, policyCtx(this.options)) ? null : false
      }
    }
  ]
},
```

The behavior change: previously rejection was based only on the 3-scheme `DANGEROUS_SCHEME_RE`. Now it uses the full policy. Anything `isSafeHyperlinkHref` rejects becomes a parse failure (the mark is silently dropped), matching what the official Tiptap Link does.

- [ ] **Step 3: Add defense-in-depth to `renderHTML`**

Replace the existing `renderHTML()` (currently lines 163-165) with:

```ts
renderHTML({ HTMLAttributes }) {
  // Defense in depth: if state was tampered with (loaded JSON,
  // collab message, manually-edited mark) the href could still be
  // malicious. Strip it before it reaches the DOM.
  const href = HTMLAttributes.href as string | null | undefined
  const safeAttrs =
    href && !isSafeHyperlinkHref(href, policyCtx(this.options))
      ? { ...HTMLAttributes, href: null }
      : HTMLAttributes
  return ['a', mergeAttributes(this.options.HTMLAttributes, safeAttrs), 0]
},
```

- [ ] **Step 4: Tighten `setHyperlink` command (the safety check must run on BOTH branches)**

In the existing `setHyperlink` command (currently lines 169-247) the function body splits on whether a popover factory is configured. The safety policy must run **before** that split — otherwise a programmatic `editor.commands.setHyperlink({ href: 'javascript:alert(1)' })` against an editor that has the default popover would skip validation entirely (the popover branch trusts whatever `attributes` it was handed). Spec §3.3 is explicit: the policy runs at "every site that writes, reads, or navigates to an `href`."

Insert a guard at the **top** of the command body, immediately after destructuring `attributes` and before the `if (this.options.popovers.createHyperlink) { … }` branch:

```ts
if (attributes?.href) {
  const normalizedHref = normalizeHref(attributes.href)
  if (!isSafeHyperlinkHref(normalizedHref, policyCtx(this.options))) return false
  if (this.options.validate && !this.options.validate(normalizedHref)) return false
  attributes = { ...attributes, href: normalizedHref }
}
```

Then leave the existing popover branch unchanged (PR 2 refactors it) and replace the no-popover fallback with:

```ts
const normalized = attributes // already safety-checked + normalized above
return chain().setMark(this.name, normalized).setMeta('preventAutolink', true).run()
```

The order matches §3.4: normalize → safety layer → legacy `validate`. Both the popover and the direct-set paths now share one guard.

> **Carryover note:** PR 2 Task 2 introduces a clean `setHyperlink` that has no popover branch (popover-opening is split into `openCreateHyperlinkPopover` / `openEditHyperlinkPopover`). The same guard pattern lands there too — but PR 2's version is structurally simpler because the branch goes away.

- [ ] **Step 5: Tighten the input rule (`addInputRules`)**

In `addInputRules()` (currently lines 287-309) replace the dangerous-scheme check:

```ts
const trimmed = url.trim()
if (DANGEROUS_SCHEME_RE.test(trimmed)) return
const normalizedUrl = normalizeHref(trimmed)
```

with:

```ts
const trimmed = url.trim()
const normalizedUrl = normalizeHref(trimmed)
if (!isSafeHyperlinkHref(normalizedUrl, policyCtx(this.options))) return
if (this.options.validate && !this.options.validate(normalizedUrl)) return
```

- [ ] **Step 6: Tighten `markPasteRule` (the `[t](u)` rule, currently lines 311-337)**

Update the `find` callback:

```ts
addPasteRules() {
  const ctx = policyCtx(this.options)
  return [
    markPasteRule({
      find: (text) =>
        find(text)
          .filter((link) => link.isLink)
          .filter((link) => isSafeHyperlinkHref(link.href, ctx))
          .filter((link) => {
            if (this.options.validate) {
              return this.options.validate(link.value)
            }
            return true
          })
          .map((link) => ({
            text: link.value,
            index: link.start,
            data: link
          })),
      type: this.type,
      getAttributes: (match) => ({
        href: normalizeLinkifyHref(match.data as LinkifyMatchLike)
      })
    })
  ]
},
```

- [ ] **Step 7: Build and run unit tests**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
```

Expected: build clean, tests green.

- [ ] **Step 8: Run E2E suite to catch regressions**

```bash
cd packages/extension-hyperlink
bun run test:e2e
```

Expected: all existing E2E tests still pass. If `xss-guards.cy.ts` now passes more cases than before (it should), that's the improvement.

- [ ] **Step 9: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): apply isSafeHyperlinkHref at every write site (B1)

Wires the new safety policy into all five paths inside hyperlink.ts:

- parseHTML.getAttrs   — rejects malicious anchors at HTML import.
- renderHTML            — strips href that became unsafe in stored state.
- setHyperlink command  — programmatic call protection.
- addInputRules         — markdown [t](u) input.
- addPasteRules         — markPasteRule for pasted content.

Each path now follows the §3.4 precedence: safety layer first, then
the legacy validate() hook. Existing setHyperlink command shape is
unchanged — popover side-effect stays through PR 1 so the webapp
keeps working; PR 2 refactors it."
```

---

## Task 7: Wire `isSafeHyperlinkHref` into the autolink plugin (B1 + M5 partial)

**Files:**

- Modify: `packages/extension-hyperlink/src/plugins/autolink.ts`

- [ ] **Step 1: Update `AutolinkOptions` to accept the safety context**

Modify `packages/extension-hyperlink/src/plugins/autolink.ts`. Replace the `AutolinkOptions` type (currently lines 16-19) with:

```ts
import type { IsSafeHyperlinkHrefContext } from '../utils/validateURL'
import { isSafeHyperlinkHref } from '../utils/validateURL'

type AutolinkOptions = {
  type: MarkType
  validate?: (url: string) => boolean
  shouldAutoLink: (url: string) => boolean
  policyCtx: IsSafeHyperlinkHrefContext
}
```

- [ ] **Step 2: Apply the §5.1 filter order in the candidate `.forEach`**

Currently (lines 180-205) the candidates are filtered by `link.isLink`, then `validate`, then mapped. Replace that chain with:

```ts
findLinks(lastWordBeforeSpace)
  .filter((link) => link.isLink)
  .filter((link) => options.shouldAutoLink(link.value))
  .filter((link) => isSafeHyperlinkHref(normalizeLinkifyHref(link), options.policyCtx))
  .filter((link) => {
    if (options.validate) {
      return options.validate(link.value)
    }
    return true
  })
  .map((link) => ({
    ...link,
    from: lastWordAndBlockOffset + link.start + 1,
    to: lastWordAndBlockOffset + link.end + 1
  }))
  .filter((link) => {
    const contextStart = Math.max(0, link.from - IMAGE_MARKDOWN_CONTEXT_CHARS)
    const beforeLink = newState.doc.textBetween(contextStart, link.from, ' ', ' ')
    const isInsideImageMarkdown = beforeLink.includes('![') && beforeLink.endsWith('](')
    return !isInsideImageMarkdown
  })
  .forEach((link) => {
    tr.addMark(link.from, link.to, options.type.create({ href: normalizeLinkifyHref(link) }))
  })
```

The order follows §3.4 + §5.1 exactly: `shouldAutoLink` → `isSafeHyperlinkHref` → `validate`. M5's already-marked / code / Unicode-whitespace fixes are applied in the next task.

- [ ] **Step 3: Update the call site in `hyperlink.ts`**

In `hyperlink.ts` `addProseMirrorPlugins()` (currently lines 339-349), update the autolink construction:

```ts
if (this.options.autolink) {
  plugins.push(
    autolinkPlugin({
      type: this.type,
      validate: this.options.validate,
      shouldAutoLink: this.options.shouldAutoLink,
      policyCtx: policyCtx(this.options)
    })
  )
}
```

- [ ] **Step 4: Build, run unit tests, run E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/src/plugins/autolink.ts packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): apply URL policy in autolink (B1, M5 partial)

autolink filter chain now follows the §3.4 precedence:
  shouldAutoLink → isSafeHyperlinkHref → validate (legacy)

shouldAutoLink and policyCtx are passed through from HyperlinkOptions
so the plugin uses the same policy as parseHTML/renderHTML/setHyperlink.

M5's autolink correctness fixes (already-marked + code-mark guards +
Unicode whitespace) land in the next task."
```

---

## Task 8: Autolink correctness fixes (M5)

**Files:**

- Create: `packages/extension-hyperlink/src/utils/whitespace.ts`
- Modify: `packages/extension-hyperlink/src/plugins/autolink.ts`

- [ ] **Step 1: Create the whitespace regex helper**

Create `packages/extension-hyperlink/src/utils/whitespace.ts`:

```ts
/**
 * Unicode-aware whitespace patterns, copied from
 * @tiptap/extension-link@3.22.4's helpers/whitespace.ts.
 *
 * Covers: ASCII space/tab/newline plus Unicode separators (NBSP,
 * em-space, en-space, ideographic space, etc.). Without these, the
 * autolink plugin only fires on ASCII space, which misses NBSP-inserted
 * paragraphs and CJK-style breaks.
 */
export const UNICODE_WHITESPACE_REGEX =
  /[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/

export const UNICODE_WHITESPACE_REGEX_END = new RegExp(UNICODE_WHITESPACE_REGEX.source + '$')
```

- [ ] **Step 2: Add the already-marked guard in autolink**

In `packages/extension-hyperlink/src/plugins/autolink.ts`, just before the `.forEach((link) => { tr.addMark(...) })` chain (line 199 area), insert a `.filter`:

```ts
.filter((link) => {
  // M5 — Skip ranges that already carry the hyperlink mark to avoid
  // emitting redundant tr.addMark steps. Mirrors official @tiptap/extension-link.
  return !getMarksBetween(link.from, link.to, newState.doc).some(
    (item) => item.mark.type === options.type
  )
})
```

This goes immediately after the image-markdown filter (so image markdown is excluded first, then already-marked second).

- [ ] **Step 3: Add the code-mark exclusion**

Right after the already-marked filter, add:

```ts
.filter((link) => {
  // M5 — Skip ranges inside the `code` mark. URLs inside code spans
  // should not be autolinked.
  const codeMark = newState.schema.marks.code
  if (!codeMark) return true
  return !newState.doc.rangeHasMark(link.from, link.to, codeMark)
})
```

- [ ] **Step 4: Replace ASCII whitespace splitting with Unicode regex**

Find the existing block (lines 156-167):

```ts
} else if (
  nodesInChangedRanges.length &&
  newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ').endsWith(' ')
) {
```

Replace `.endsWith(' ')` with the Unicode test:

```ts
} else if (
  nodesInChangedRanges.length &&
  UNICODE_WHITESPACE_REGEX_END.test(
    newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ')
  )
) {
```

Find the splitting block (line 171):

```ts
const wordsBeforeWhitespace = textBeforeWhitespace.split(' ').filter((s) => s !== '')
```

Replace with:

```ts
const wordsBeforeWhitespace = textBeforeWhitespace
  .split(UNICODE_WHITESPACE_REGEX)
  .filter((s) => s !== '')
```

- [ ] **Step 5: Add the import**

At the top of `autolink.ts`:

```ts
import { UNICODE_WHITESPACE_REGEX, UNICODE_WHITESPACE_REGEX_END } from '../utils/whitespace'
```

- [ ] **Step 6: Build, run unit tests, run E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green. The existing `autolink.cy.ts` should still pass; new behaviors are additive (won't double-link, won't link in code, will respect NBSP).

- [ ] **Step 7: Commit**

```bash
git add packages/extension-hyperlink/src/utils/whitespace.ts packages/extension-hyperlink/src/plugins/autolink.ts
git commit -m "fix(extension-hyperlink): autolink parity guards from @tiptap/extension-link (M5)

Three correctness fixes mirroring @tiptap/extension-link@3.22.4:

- Skip ranges that already carry the hyperlink mark (avoids redundant
  tr.addMark steps when autolink runs on a transaction that already
  produced a link).
- Skip ranges inside the `code` mark (URLs in code spans stay literal).
- Use UNICODE_WHITESPACE_REGEX for word boundaries instead of
  String.split(' ') / endsWith(' '). NBSP, em-space, ideographic
  space etc. now correctly trigger autolink. New utility module:
  src/utils/whitespace.ts (two RegExp constants — no folder)."
```

---

## Task 9: Click handler — Cmd/Ctrl/middle-click + noopener (M6)

**Files:**

- Modify: `packages/extension-hyperlink/src/plugins/clickHandler.ts`

- [ ] **Step 1: Update `preventMouseDown` to bail on modifier-clicks**

In `packages/extension-hyperlink/src/plugins/clickHandler.ts`, replace the existing `preventMouseDown` and `preventClick` (currently lines 139-151) with:

```ts
const preventMouseDown = (event: MouseEvent) => {
  // Browser-default behaviors take precedence:
  //   - Middle-click (button 1) → open in new tab.
  //   - Cmd/Ctrl-click → open in new background tab.
  //   - Any non-primary button → context menu, side-buttons, etc.
  if (event.button !== 0 || event.metaKey || event.ctrlKey) return
  const link = findLinkFromEvent(event, editorView.dom)
  if (!link) return
  event.preventDefault()
  event.stopPropagation()
}

const preventClick = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey) return
  const link = findLinkFromEvent(event, editorView.dom)
  if (link) event.preventDefault()
}
```

- [ ] **Step 2: Update the `click` handleDOMEvent (line 175-184) similarly**

```ts
click: (view: EditorView, event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey) return false

  const link = findLinkFromEvent(event, view.dom)
  if (!link) return false

  event.preventDefault()
  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
  return showPopover(view, link, options, pos?.pos)
}
```

- [ ] **Step 3: Pass `noopener,noreferrer` to `window.open`**

In `showPopover` (line 67-68), replace:

```ts
if (href && !view.editable && !DANGEROUS_SCHEME_RE.test(href)) {
  window.open(href, targetAttr ?? undefined)
}
```

with:

```ts
if (href && !view.editable && !DANGEROUS_SCHEME_RE.test(href)) {
  // Always pass noopener,noreferrer so the new tab can't access
  // window.opener (reverse-tabnabbing) or send a Referer header.
  window.open(href, targetAttr ?? '_blank', 'noopener,noreferrer')
}
```

The fallback `'_blank'` matches what users get when omitting target on an `<a>` with `noopener` rel — keeps semantics identical for the common case.

- [ ] **Step 4: Build, run E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green. Manually sanity-check Cmd-click in the playground:

```bash
cd packages/extension-hyperlink
bun run playground
# in browser: type "https://example.com ", autolink fires, Cmd-click → opens in new tab
```

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/src/plugins/clickHandler.ts
git commit -m "fix(extension-hyperlink): respect modifier-click + harden window.open (M6)

Click handler no longer intercepts:
- Cmd-click (macOS) / Ctrl-click (Linux/Windows) → open in new tab.
- Middle-click (button 1) → open in new tab.
- Right-click / side-buttons → browser context menu / nav.

Primary-click behavior unchanged (still opens preview popover).

window.open now always passes 'noopener,noreferrer' so opened tabs
can't reach window.opener (reverse-tabnabbing) and don't leak a
Referer header. Fallback target is '_blank' when none is set."
```

---

## Task 10: Wire policy into `pasteHandler.ts`

**Files:**

- Modify: `packages/extension-hyperlink/src/plugins/pasteHandler.ts`
- Modify: `packages/extension-hyperlink/src/hyperlink.ts`

- [ ] **Step 1: Add policy to `PasteHandlerOptions`**

In `packages/extension-hyperlink/src/plugins/pasteHandler.ts`:

```ts
import { isSafeHyperlinkHref, type IsSafeHyperlinkHrefContext } from '../utils/validateURL'

type PasteHandlerOptions = {
  editor: Editor
  type: MarkType
  validate?: (url: string) => boolean
  policyCtx: IsSafeHyperlinkHrefContext
}
```

- [ ] **Step 2: Apply policy before `setMark`**

Replace the existing `handlePaste` body (currently lines 18-48) with:

```ts
handlePaste: (view, event, slice) => {
  const { state } = view
  const { selection } = state
  const { empty } = selection

  if (empty) return false

  let textContent = ''
  slice.content.forEach((node) => {
    textContent += node.textContent
  })

  if (!textContent) return false

  const link = find(textContent, {
    defaultProtocol: options.policyCtx.defaultProtocol
  }).find((item) => item.isLink && item.value === textContent)

  if (!link) return false

  const normalizedHref = normalizeLinkifyHref(link)

  // §3.4 precedence: safety layer first, then legacy validate.
  if (!isSafeHyperlinkHref(normalizedHref, options.policyCtx)) return false
  if (options.validate && !options.validate(link.href)) return false

  options.editor.commands.setMark(options.type, { href: normalizedHref })
  return true
}
```

- [ ] **Step 3: Update the call site in `hyperlink.ts`**

In `addProseMirrorPlugins()` find the `pasteHandlerPlugin` construction (currently lines 362-370) and update:

```ts
if (this.options.linkOnPaste) {
  plugins.push(
    pasteHandlerPlugin({
      editor: this.editor,
      type: this.type,
      validate: this.options.validate,
      policyCtx: policyCtx(this.options)
    })
  )
}
```

- [ ] **Step 4: Build, run unit + E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/src/plugins/pasteHandler.ts packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): apply URL policy on paste (B1)

pasteHandler now runs through isSafeHyperlinkHref before setMark,
matching the precedence applied to setHyperlink/markPasteRule/autolink.

Also passes defaultProtocol into linkifyjs.find() so paste behavior
matches the rest of the extension when consumers override it."
```

---

## Task 11: Render `target` attribute correctly (M9)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`
- Create: `packages/extension-hyperlink/src/__tests__/renderRoundTrip.test.ts`

- [ ] **Step 1: Write the failing snapshot test first**

Create `packages/extension-hyperlink/src/__tests__/renderRoundTrip.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { Editor } from '@tiptap/core'
import { Document } from '@tiptap/extension-document'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'

import { Hyperlink } from '../hyperlink'

const html = (json: object) => {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Hyperlink],
    content: json
  })
  const out = editor.getHTML()
  editor.destroy()
  return out
}

describe('hyperlink render round-trip', () => {
  test('target attribute is rendered into HTML', () => {
    const out = html({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click me',
              marks: [
                {
                  type: 'hyperlink',
                  attrs: { href: 'https://example.com', target: '_blank', rel: null, class: null }
                }
              ]
            }
          ]
        }
      ]
    })
    // Pre-fix this lacked target="_blank"; M9 fix adds it.
    expect(out).toContain('target="_blank"')
    expect(out).toContain('href="https://example.com"')
  })

  test('rel attribute round-trips', () => {
    const out = html({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click me',
              marks: [
                {
                  type: 'hyperlink',
                  attrs: {
                    href: 'https://example.com',
                    target: null,
                    rel: 'noopener',
                    class: null
                  }
                }
              ]
            }
          ]
        }
      ]
    })
    expect(out).toContain('rel="noopener"')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails for `target`**

```bash
bun test src/__tests__/renderRoundTrip.test.ts
```

Expected: the `target` test fails (because `rendered: false` drops it).

- [ ] **Step 3: Remove `rendered: false` from `target`**

In `hyperlink.ts` `addAttributes()` (currently line 127-130):

```ts
target: {
  default: this.options.HTMLAttributes.target,
  rendered: false
},
```

Change to:

```ts
target: {
  default: this.options.HTMLAttributes.target
},
```

- [ ] **Step 4: Run the snapshot test — should pass**

```bash
bun test src/__tests__/renderRoundTrip.test.ts
```

Expected: green.

- [ ] **Step 5: Run full unit suite + E2E to catch regressions**

```bash
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green. If a Cypress spec was relying on `target` being silently dropped (unlikely), surface and fix.

- [ ] **Step 6: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts \
        packages/extension-hyperlink/src/__tests__/renderRoundTrip.test.ts
git commit -m "fix(extension-hyperlink): render target attribute (M9)

target had rendered: false on the mark schema, so target=\"_blank\"
in stored doc state never made it back into HTML output. Removing
the flag closes that gap; existing docs that already have target
on the mark now render it as users intended.

Snapshot test added for parse → render fidelity (target + rel)."
```

---

## Task 12: Extend xss-guards.cy.ts with attack vectors (T8)

**Files:**

- Modify: `packages/extension-hyperlink/cypress/e2e/xss-guards.cy.ts`

- [ ] **Step 1: Read the existing spec to learn its conventions**

```bash
cat packages/extension-hyperlink/cypress/e2e/xss-guards.cy.ts
```

Note the playground URL, the editor selector, and how it currently asserts rejection (likely "no `<a>` is rendered" or "href stripped").

- [ ] **Step 2: Add a table-driven `describe` block at the bottom of the spec**

Append (or insert before `})`):

```ts
describe('attack-vector matrix (T8)', () => {
  const dangerous = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)', // leading space
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'blob:https://evil.com/abc',
    'about:blank',
    'chrome://settings',
    'view-source:https://evil.com',
    'https://user:pass@evil.com'
  ]

  dangerous.forEach((href) => {
    it(`rejects ${href} via setHyperlink command`, () => {
      cy.visitPlayground()
      cy.get('#editor').click().type('select me{selectall}')
      cy.window().then((win) => {
        const ok = win._editor.chain().focus().setHyperlink({ href }).run()
        expect(ok).to.equal(false)
      })
      // No anchor should have appeared in the editor.
      cy.get('#editor a').should('not.exist')
    })

    it(`rejects ${href} when pasted`, () => {
      cy.visitPlayground()
      cy.get('#editor').click().type('select me{selectall}')
      cy.window().then((win) => {
        const dt = new DataTransfer()
        dt.setData('text/plain', href)
        win._editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
      })
      cy.get('#editor a').should('not.exist')
    })
  })
})
```

> **Convention note:** the playground already exposes the editor as `window._editor` and ships a `cy.visitPlayground()` custom command via `cypress/support/e2e.ts`. Every existing spec (`xss-guards.cy.ts`, `create.cy.ts`, etc.) uses these, so this new spec must follow the same convention. Do **not** add a new `window.editor` assignment to `test/playground/main.ts` — `_editor` is the single source of truth.

- [ ] **Step 3: Run the new spec**

```bash
cd packages/extension-hyperlink
bun run test:e2e -- --spec cypress/e2e/xss-guards.cy.ts
```

Expected: all attack-vector rows pass. If any passes (i.e. an anchor IS rendered for a dangerous URL), find which path failed (parseHTML/setHyperlink/paste) and re-check Tasks 5-11.

- [ ] **Step 4: Commit**

```bash
git add packages/extension-hyperlink/cypress/e2e/xss-guards.cy.ts
git commit -m "test(extension-hyperlink): table-driven attack-vector matrix (T8)

Adds 13 dangerous-URL inputs covering: javascript: (3 forms), data:
(3 forms), vbscript:, file://, blob:, about:, chrome:, view-source:,
and embedded credentials.

Each input is asserted twice: via setHyperlink command and via paste.
Both paths must reject — no <a> in the DOM after either action."
```

---

## Task 13: Paste vs autolink vs markPasteRule policy parity (T9)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/paste-policy.cy.ts`

- [ ] **Step 1: Create the spec**

```ts
import { pressMod } from '../support/keyboard'

describe('URL policy parity across paste / markPasteRule / autolink (T9)', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.get('#editor').click()
  })

  const dangerous = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'view-source:https://evil.com'
  ]

  const safe = ['https://example.com', 'mailto:test@example.com', 'tel:+15551234567']

  dangerous.forEach((href) => {
    it(`rejects ${href} consistently across all three paths`, () => {
      // 1. paste path
      cy.get('#editor').type('select{selectall}')
      cy.window().then((win) => {
        const dt = new DataTransfer()
        dt.setData('text/plain', href)
        win._editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
      })
      cy.get('#editor a').should('not.exist')

      // 2. markPasteRule (markdown [text](href))
      cy.get('#editor').type('{selectall}{backspace}').type(`[click](${href})`)
      cy.get('#editor a').should('not.exist')

      // 3. autolink — type the bare URL followed by space
      cy.get('#editor').type('{selectall}{backspace}').type(`${href} `)
      cy.get('#editor a').should('not.exist')
    })
  })

  safe.forEach((href) => {
    it(`accepts ${href} consistently across all three paths`, () => {
      // 1. paste path (requires non-empty selection)
      cy.get('#editor').type('hello{selectall}')
      cy.window().then((win) => {
        const dt = new DataTransfer()
        dt.setData('text/plain', href)
        win._editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
      })
      cy.get('#editor a').should('have.attr', 'href', href)

      // 2. markPasteRule
      cy.get('#editor').type('{selectall}{backspace}').type(`[label](${href})`)
      cy.get('#editor a').should('have.attr', 'href', href)

      // 3. autolink (only really applies to URL-shaped strings; mailto/tel
      //    don't get autolinked from typing — they're paste-only).
      if (href.startsWith('http')) {
        cy.get('#editor').type('{selectall}{backspace}').type(`${href} `)
        cy.get('#editor a').should('have.attr', 'href', href)
      }
    })
  })
})
```

- [ ] **Step 2: Run the spec**

```bash
bun run test:e2e -- --spec cypress/e2e/paste-policy.cy.ts
```

Expected: all green. If any path inconsistently accepts/rejects, the wiring in Tasks 7/8/11 missed a place.

- [ ] **Step 3: Commit**

```bash
git add packages/extension-hyperlink/cypress/e2e/paste-policy.cy.ts
git commit -m "test(extension-hyperlink): assert URL policy parity across paths (T9)

Same 4 dangerous + 3 safe URLs run through paste, markdown markPasteRule,
and autolink. All three paths must agree — anything one accepts the
others must accept too, and vice versa. Catches the historical drift
where paste used linkify-only validation while parseHTML used the
denylist."
```

---

## Task 14: publint pre-publish gate

**Files:**

- Modify: `packages/extension-hyperlink/scripts/preflight.ts`

- [ ] **Step 1: Read the current preflight script**

```bash
cat packages/extension-hyperlink/scripts/preflight.ts
```

Note its existing structure and how it reports failures.

- [ ] **Step 2: Append a publint check**

At the end of the script (before any `process.exit(0)`), add:

```ts
// publint — catches packaging mistakes that publint knows how to spot
// (broken exports map, missing main/module/types, condition mismatches).
console.log('\n[preflight] running publint…')
const publintResult = Bun.spawnSync(['bunx', 'publint', '--strict', '.'], {
  cwd: import.meta.dirname + '/..',
  stdout: 'inherit',
  stderr: 'inherit'
})
if (publintResult.exitCode !== 0) {
  console.error('[preflight] publint reported issues — see above.')
  process.exit(1)
}
console.log('[preflight] publint clean.')
```

Adjust the `cwd` calculation if the existing preflight uses a different base-path pattern.

- [ ] **Step 3: Build then run preflight to test**

```bash
cd packages/extension-hyperlink
bun run build
bun run scripts/preflight.ts
```

Expected: completes green. If publint reports issues, fix them now (likely candidates: `exports` paths, `types` field). Document any fix in the commit message.

- [ ] **Step 4: Commit**

```bash
git add packages/extension-hyperlink/scripts/preflight.ts
git commit -m "build(extension-hyperlink): gate prepublishOnly on publint

preflight.ts now runs publint --strict on the package after build,
exiting non-zero if publint reports any issue. Catches broken
exports map, missing types, and dual-publish edge cases before
they reach npm. prepublishOnly already calls preflight, so this
becomes a hard publish gate."
```

---

## Task 15: CI workflow (B4)

**Files:**

- Create: `.github/workflows/extension-hyperlink.yml`
- Modify: `packages/extension-hyperlink/package.json` (scripts)

Coverage enforcement is the workspace-wide line threshold defined in `bunfig.toml` (Task 0) — `bun test --coverage` exits non-zero if it slips below. No per-path script, no separate gate to maintain. Security paths (URL policy, paste, autolink) are pinned by the table-driven E2E specs in Tasks 12 + 13 which fail with a recognizable signature long before coverage drift can hide a regression.

- [ ] **Step 1: Add the coverage script to package.json**

Add to `packages/extension-hyperlink/package.json` `scripts`:

```json
"test:unit:coverage": "bun test --coverage src"
```

The threshold from `bunfig.toml` is consulted automatically by `bun test --coverage`.

- [ ] **Step 2: Run locally to verify the threshold passes**

```bash
cd packages/extension-hyperlink
bun run test:unit:coverage
```

Expected: green. If coverage slips below 0.85, add the missing tests now (PR 1 ships new test files for `isSafeHyperlinkHref` already; that should bring the line up). Do **not** lower the threshold to make it pass.

- [ ] **Step 3: Write the GitHub Actions workflow**

Create `.github/workflows/extension-hyperlink.yml`:

Create `.github/workflows/extension-hyperlink.yml`:

```yaml
name: extension-hyperlink

on:
  pull_request:
    paths:
      - 'packages/extension-hyperlink/**'
      - 'bun.lock'
      - 'package.json'
      - '.github/workflows/extension-hyperlink.yml'
  push:
    branches: [main]
    paths:
      - 'packages/extension-hyperlink/**'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run --filter @docs.plus/extension-hyperlink lint

      - name: Unit tests + coverage
        run: bun run --filter @docs.plus/extension-hyperlink test:unit:coverage

      - name: Build
        run: bun run --filter @docs.plus/extension-hyperlink build

      - name: publint
        working-directory: packages/extension-hyperlink
        run: bunx publint --strict .

      - name: Cypress E2E
        run: bun run --filter @docs.plus/extension-hyperlink test:e2e

      - name: Upload Cypress artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-artifacts
          path: |
            packages/extension-hyperlink/cypress/screenshots
            packages/extension-hyperlink/cypress/videos
          retention-days: 7
```

- [ ] **Step 4: Validate the workflow YAML**

```bash
bunx actionlint .github/workflows/extension-hyperlink.yml || true
```

Expected: no syntax errors. If actionlint flags something, fix.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/extension-hyperlink.yml packages/extension-hyperlink/package.json
git commit -m "ci(extension-hyperlink): gate the package on PR (B4)

New workflow runs on every PR touching the package and on main pushes:
  lint → unit tests + coverage → build → publint --strict →
  Cypress E2E → upload artifacts on failure.

Coverage threshold is the single workspace gate from bunfig.toml
(line ≥0.85). No per-path script — the highest-risk paths (URL
safety, paste, autolink) are pinned by table-driven E2E specs
(xss-guards, paste-policy) added in Tasks 12 + 13, which fail
with a recognizable signature long before coverage drift can
hide a regression.

Concurrency cancels superseded runs. Frozen lockfile install.
Branch protection on main should be configured to require this
check once the workflow lands."
```

---

## Task 16: PR 1 wrap-up — run the full quality gate locally

**Files:** none (verification only)

- [ ] **Step 1: Run every quality check end-to-end as CI would**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
bun install
bun run --filter @docs.plus/extension-hyperlink lint
bun run --filter @docs.plus/extension-hyperlink test:unit:coverage
bun run --filter @docs.plus/extension-hyperlink build
cd packages/extension-hyperlink && bunx publint --strict .
cd ../.. && bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: every command exits 0.

- [ ] **Step 2: Amend the existing `[2.0.0]` CHANGELOG entry with PR 1's items**

`packages/extension-hyperlink/CHANGELOG.md` already contains a comprehensive `## [2.0.0] — 2026-04-20` entry from earlier work that documents most of the rewrite (popover architecture, normalizeHref, special-URL catalog, the 3-scheme `DANGEROUS_SCHEME_RE`, default stylesheet, Cypress harness). PR 1 / PR 2 / PR 3 are **completing the 2.0 commitments**, not opening a new release. Strategy: **amend the existing entry in place** — add this PR's specific new items into the right subsections, do **not** add a `[Unreleased]` header (it would land as the second 2.0.0 header at release time).

First read the current file end-to-end so you understand which subsections already exist and where to slot the new items:

```bash
cat packages/extension-hyperlink/CHANGELOG.md | head -200
```

Then add the following items, **inserted into the existing subsections** (look for the `### Security`, `### Added`, `### Changed`, `### Internal` headings under `## [2.0.0] — 2026-04-20`). Match the existing prose style — concise, one bullet per item, prefix with the review-item ID in bold:

```markdown
### Security (insert these alongside what's already there)

- **B1** Denylist expanded from `javascript:` / `data:` / `vbscript:` (the original `DANGEROUS_SCHEME_RE`) to also cover `file:`, `blob:`, `about:`, `chrome:`, `view-source:`. Embedded credentials (`user:pass@host`) rejected by default for web schemes. The exported `DANGEROUS_SCHEME_RE` is updated in lockstep.
- **B1** Single URL safety policy (`isSafeHyperlinkHref`) applied at every href write site (parseHTML, renderHTML, setHyperlink, input rule, markPasteRule, paste, autolink, click navigation) — replaces the previous mix of `DANGEROUS_SCHEME_RE` checks and ad-hoc validation.
- **M6** Click handler now respects Cmd/Ctrl/middle-click and passes `noopener,noreferrer` to `window.open`.

### Added

- **M1** New `HyperlinkOptions`: `defaultProtocol`, `isAllowedUri`, `enableClickSelection`, `shouldAutoLink` — Tiptap-Link parity options. Precedence between `isAllowedUri`, `isSafeHyperlinkHref`, and `validate` documented in JSDoc.

### Changed

- **M5** Autolink skips ranges already carrying the hyperlink mark, ranges inside `code`, and uses Unicode whitespace boundaries (`UNICODE_WHITESPACE_REGEX`) instead of ASCII space.
- **M9** `target` attribute now round-trips through `renderHTML` (previously had `rendered: false`).
- **M7** `bun-types` pinned to workspace catalog (was `latest`); `bun-types` added to the workspace catalog in `package.json`.
- **M8** `linkifyjs` moved from `dependencies` to `peerDependencies` for app-level deduplication. Webapp `dependencies` add `linkifyjs` explicitly.

### Fixed

- **B5** Removed `normalizeLinkifyHref` row from the README (it was never exported).

### Internal (or add the section if it doesn't exist yet)

- **B4** New CI workflow (`.github/workflows/extension-hyperlink.yml`) gating the package on lint, unit + coverage, build, publint, and Cypress. Single workspace-wide line-coverage gate (≥0.85) via `bunfig.toml`.
- **T8** New attack-vector matrix in `xss-guards.cy.ts` covering 13 dangerous URL forms.
- **T9** New `paste-policy.cy.ts` asserts policy parity across paste / markPasteRule / autolink.
- **M11** Cross-platform `Mod` key Cypress helper (`pressMod`) replaces hard-coded `'Meta'` so tests pass on Linux CI.
```

> **Conflict guard:** if any item you'd add already appears in the existing `[2.0.0]` entry (e.g. the original `DANGEROUS_SCHEME_RE` security note), **edit that bullet in place** rather than duplicating it. The bullet for B1's expanded denylist supersedes the existing 3-scheme bullet.

- [ ] **Step 3: Commit the CHANGELOG**

```bash
git add packages/extension-hyperlink/CHANGELOG.md
git commit -m "docs(extension-hyperlink): amend [2.0.0] CHANGELOG with PR 1 items"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/extension-hyperlink-2.0
gh pr create \
  --title "feat(extension-hyperlink): 2.0 PR 1 — safety + parity foundations" \
  --body "$(cat <<'EOF'
## Summary

First of three PRs implementing the 2.0 GA design from
\`docs/superpowers/specs/2026-04-21-extension-hyperlink-2.0-design.md\`.

This PR is **safe by default**: it tightens security and adds Tiptap-Link
parity options without changing the public command shape. The webapp
keeps working unchanged (the breaking command-API refactor is in PR 2).

### What changed

- **B1** Single URL safety policy (`isSafeHyperlinkHref`) applied
  everywhere `href` is written.
- **M1** Tiptap-Link parity options (`defaultProtocol`, `isAllowedUri`,
  `enableClickSelection`, `shouldAutoLink`).
- **M5** Autolink correctness fixes (already-marked, code-mark,
  Unicode whitespace).
- **M6** Click handler respects modifier-clicks; `window.open` passes
  `noopener,noreferrer`.
- **M9** `target` attribute round-trips through HTML correctly.
- **M7 / M8** `bun-types` pinned, `linkifyjs` moved to peer deps.
- **B4** CI workflow gates lint, unit + coverage, build, publint, E2E.
- **B5** README inaccuracy removed.
- **T8 / T9 / M11** Test coverage for attack vectors, path parity,
  and platform-aware Mod key.

> Note: the mark/UI seam ESLint rule (S1 / §3.2) lands in PR 2 as part of
> the click handler refactor — shipping it here would force two
> immediate suppressions for code PR 2 deletes anyway.

### What's NOT in this PR

- `setHyperlink` is **not yet** refactored to a pure mark command —
  PR 2 lands that breaking change alongside the webapp updates.
- Popover a11y (B2) and lifecycle (B3) — PR 2.
- Markdown defaults (M3), `toggleHyperlink` (M2) — PR 2.
- README rewrite + migration guide (M10), undo/redo + mobile tests
  (T1, T5) — PR 3.

### Test plan

- [x] \`bun run --filter @docs.plus/extension-hyperlink lint\`
- [x] \`bun run --filter @docs.plus/extension-hyperlink test:unit:coverage\` (gates the workspace ≥0.85 line threshold)
- [x] \`bun run --filter @docs.plus/extension-hyperlink build\`
- [x] \`bunx publint --strict packages/extension-hyperlink/\`
- [x] \`bun run --filter @docs.plus/extension-hyperlink test:e2e\`
- [ ] CI green on PR
EOF
)"
```

- [ ] **Step 5: Verify CI is green**

Wait for the new \`extension-hyperlink\` workflow to complete on the PR. Address any failures (likely candidates: lockfile drift, Cypress timing on slower runners). Do not merge until green.

---

## Self-review checklist (run before declaring PR 1 done)

- [ ] Every task ends with a commit.
- [ ] Every commit message mentions the review item ID (B1, M5, etc.) it addresses.
- [ ] No commit introduces lint violations.
- [ ] `bun run --filter @docs.plus/extension-hyperlink test` passes locally.
- [ ] CI on the PR is green.
- [ ] CHANGELOG `[2.0.0] — 2026-04-20` section is amended to reflect every PR 1 change (no separate `[Unreleased]` header).
- [ ] No code comment narrates _what_ the code does — only _why_ (per AGENTS.md).
