# `@docs.plus/extension-hyperlink` 2.0 GA — Design Spec

**Status:** Approved 2026-04-21
**Owner:** docs.plus core team
**Implementation worktree:** `../docsy-extension-hyperlink-2.0` on branch `feat/extension-hyperlink-2.0`
**Source review:** see parallel agent reports summarized in the chat dated 2026-04-21.

---

## 1. Goals

1. Ship `@docs.plus/extension-hyperlink@2.0.0` as a production-ready Tiptap 3 mark extension.
2. Close 25 of 27 review items: 5 blockers + 11 of 12 majors + all 9 test gaps + the strategic cohesion decision (S1, addressed by §3.2). **Deferred:** M12 (rationale in §7.1). **Out of scope:** the 11 nits.
3. Meet the following industry-standard quality flags:
   - **publint** clean on every publish.
   - **WCAG 2.1 AA** verified via `cypress-axe` on every popover flow.
   - **≥90% line coverage** on the URL-policy and core mark code paths.
   - **Conventional Commits** in commit messages (commitlint already exists at repo root).
   - **Accurate README** including a migration section from `@tiptap/extension-link`.
4. Zero data migration for docs.plus production: the schema mark name `hyperlink` is preserved.
5. Update the `packages/webapp` consumer in lock-step so docs.plus production keeps working through the API change in M4 (see §12.1).

## 2. Non-goals

- Renaming the schema mark to `link`. The webapp's markdown parser writes `hyperlink`; renaming would break stored documents.
- Splitting into two npm packages (mark vs. UI). The seam is internal only.
- Folder restructure (`core/`, `ui/`, `url-policy/` namespaces). Existing `src/{plugins,popovers,helpers,utils}` layout stays.
- Typedoc / generated documentation site.
- `arethetypeswrong` in addition to `publint` (publint covers the relevant cases for this package).
- Changesets or release-please tooling. CHANGELOG continues to be hand-maintained.
- Visual regression suite beyond the existing screenshot-on-failure setup.
- Dependabot / Snyk / supply-chain wiring (workspace-level decision, not extension-level).
- New abstractions in the popover layer (state machines, plugin systems, etc.).

## 3. Architecture

### 3.1 Package shape (unchanged on disk)

```
packages/extension-hyperlink/src/
├── hyperlink.ts                 ← Mark.create — pure mark commands only
├── index.ts                     ← public exports map
├── styles.css
├── plugins/
│   ├── autolink.ts
│   ├── clickHandler.ts
│   └── pasteHandler.ts
├── popovers/
│   ├── createHyperlinkPopover.ts
│   ├── editHyperlinkPopover.ts
│   ├── previewHyperlinkPopover.ts
│   └── index.ts
├── helpers/
│   ├── editHyperlink.ts
│   └── floatingToolbar.ts
└── utils/
    ├── createHTMLElement.ts
    ├── copyToClipboard.ts
    ├── icons.ts
    ├── normalizeHref.ts
    ├── phone.ts
    ├── specialUrls.ts
    ├── validateURL.ts          ← gains isSafeHyperlinkHref()
    └── index.ts
```

### 3.2 The pluggable seam (no folder rename)

The mark and ProseMirror plugins must not reach into the popover layer. This is enforced by **one ESLint rule**, not by folder discipline:

```js
// packages/extension-hyperlink/eslint.config.js
{
  files: ['src/hyperlink.ts', 'src/plugins/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: [
            './popovers/*', '../popovers/*',
            './helpers/floatingToolbar*', '../helpers/floatingToolbar*',
          ],
          message: 'Core mark/plugins must not import UI. Use the popover factory passed via Hyperlink options.',
        },
      ],
    }],
  },
}
```

The popover factories are configured by the consumer through `Hyperlink.configure({ popovers: { … } })`. Default UI factories live in `src/popovers/*` and are imported by the consumer (or by the playground / webapp), not by the mark itself.

### 3.3 URL-policy single source of truth

A new function `isSafeHyperlinkHref(href, ctx)` is added inside the existing `src/utils/validateURL.ts`. It is the only place that decides whether an `href` is allowed to be written to a hyperlink mark.

```ts
// Pseudocode — final signature locked in PR 1
export function isSafeHyperlinkHref(
  href: string,
  ctx: {
    defaultProtocol: string
    protocols: ProtocolConfig[]
    isAllowedUri?: (href: string, ctx: UriContext) => boolean
  }
): boolean
```

- Built-in **denylist (extended from current 3 schemes):** `javascript`, `data`, `vbscript`, `file`, `blob`, `about`, `chrome`, `view-source`.
- Built-in **allowlist:** `http`, `https`, `mailto`, `tel`, `sms`, `ftp`, `ftps`, `geo`, plus any scheme present in `specialUrls.ts`.
- Custom `protocols` registered via the option are appended to the allowlist.
- If `isAllowedUri` is provided by the consumer, its boolean return value is final (Tiptap-Link parity).

`isSafeHyperlinkHref` is called at every site that writes, reads, or navigates to an `href`:

| Site                                  | File                                  | Kind     | Why                                                                        |
| ------------------------------------- | ------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `setMark` chain inside `setHyperlink` | `hyperlink.ts`                        | write    | Programmatic call protection                                               |
| `parseHTML.getAttrs`                  | `hyperlink.ts`                        | write    | Untrusted HTML import                                                      |
| `renderHTML`                          | `hyperlink.ts`                        | write    | Defense in depth — strip bad `href` from output even if state was tampered |
| `pasteHandler`                        | `plugins/pasteHandler.ts`             | write    | User paste                                                                 |
| `markPasteRule` (markdown `[t](u)`)   | `hyperlink.ts`                        | write    | Markdown autolinking                                                       |
| `autolink`                            | `plugins/autolink.ts`                 | write    | Typed-text autolink                                                        |
| `clickHandler` navigation             | `plugins/clickHandler.ts`             | navigate | `window.open` gate                                                         |
| Preview popover render                | `popovers/previewHyperlinkPopover.ts` | read     | Display- and Open-button gate                                              |

### 3.4 Option precedence

Three options can each veto an `href`. The order is fixed and documented in JSDoc on the option types:

1. **`isAllowedUri(href, ctx)` — if defined, its return value is final.** Highest precedence; lets consumers override built-in policy.
2. **`isSafeHyperlinkHref` built-in denylist + allowlist** — only consulted when `isAllowedUri` is not defined.
3. **`validate(href)` — legacy escape hatch.** Runs _after_ `isAllowedUri`/`isSafeHyperlinkHref` accept; can additionally reject on business rules. Cannot accept what the safety layer rejected.

`shouldAutoLink(url)` runs only inside the autolink plugin and is independent — it gates whether autolink fires at all, and runs before `isSafeHyperlinkHref`.

## 4. Public API changes

### 4.1 Options (`HyperlinkOptions`)

| Option                 | Status                      | Notes                                                                     |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `HTMLAttributes`       | unchanged                   |                                                                           |
| `autolink`             | unchanged                   |                                                                           |
| `linkOnPaste`          | unchanged                   |                                                                           |
| `openOnClick`          | unchanged shape (`boolean`) | No deprecated `'whenNotEditable'` branch.                                 |
| `validate`             | unchanged                   | Remains as user escape hatch.                                             |
| `popovers`             | unchanged                   | Factory functions, opt-in.                                                |
| `defaultProtocol`      | **NEW (M1)**                | Defaults to `'https'`. Used by `normalizeHref` and `isSafeHyperlinkHref`. |
| `isAllowedUri`         | **NEW (M1)**                | Tiptap-Link parity.                                                       |
| `protocols`            | **NEW (M1)**                | `Array<string \| { scheme: string, optionalSlashes?: boolean }>`.         |
| `enableClickSelection` | **NEW (M1)**                | Default `false`.                                                          |
| `shouldAutoLink`       | **NEW (M1)**                | Default `() => true`.                                                     |

### 4.2 Commands

| Command                                                   | Status           | Behavior                                                                                                                                              |
| --------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setHyperlink({ href, target?, rel?, class? })`           | **CHANGED (M4)** | Pure: applies the mark to current selection. **Always.** No UI side effects. Existing popover-opening behavior moves to `openCreateHyperlinkPopover`. |
| `unsetHyperlink()`                                        | unchanged        |                                                                                                                                                       |
| `toggleHyperlink({ href, … })`                            | **NEW (M2)**     | Toggles the mark on/off, Tiptap-Link parity.                                                                                                          |
| `editHyperlink`, `editHyperlinkText`, `editHyperlinkHref` | unchanged        | All remain pure transaction commands.                                                                                                                 |
| `openCreateHyperlinkPopover()`                            | **NEW (M4)**     | Opens the create popover when `popovers.createHyperlink` is configured; no-op (returns `false`) otherwise.                                            |
| `openEditHyperlinkPopover()`                              | **NEW (M4)**     | Same pattern for edit.                                                                                                                                |

### 4.3 Keyboard shortcut

`Mod-k` runs `openCreateHyperlinkPopover()` unconditionally. The command itself returns `false` (no-op) when no `popovers.createHyperlink` factory is configured, so consumers without UI must override the shortcut to bind their own UX. This keeps the mark fully UI-free per the seam in §3.2; the shortcut is the only place the extension assumes UI exists, and even then it degrades gracefully. Documented in README §5.

### 4.4 Webapp-consumer impact (M4 breaking change)

Four call sites in `packages/webapp` currently invoke `setHyperlink()` with no arguments and rely on the deprecated popover side-effect:

- `packages/webapp/src/components/pages/document/components/MobileBubbleMenu.tsx:37`
- `packages/webapp/src/components/TipTap/toolbar/desktop/EditorToolbar.tsx:174`
- `packages/webapp/src/components/chatroom/components/MessageComposer/components/Toolbar/ToolbarButtons/HyperlinkButton.tsx:15`
- `packages/webapp/src/components/TipTap/toolbar/mobile/ToolbarMobile.tsx:74`

All four are mechanically rewritten in PR 2 to `editor.chain().focus().openCreateHyperlinkPopover().run()`. No semantic change to UX. The webapp's existing call sites for `unsetHyperlink()` and the popover wiring in `LinkPreviewSheet.tsx` / `previewHyperlink.ts` continue to work unchanged.

### 4.5 Mark schema additions

- `exitable: true` (M3 — Tiptap-Link parity).
- `target` attribute: remove `rendered: false` so the attribute round-trips through `renderHTML` correctly (M9). **Compatibility note:** existing stored docs that have a `target` attribute on the mark will now render it into the output `<a target="…">` where they previously dropped it silently. This matches user expectation and does not require data migration. Parse → render snapshot test covers fidelity.
- Default `markdownTokenName: 'link'`, default `parseMarkdown` and `renderMarkdown` (M3). Webapp's `Hyperlink.extend({ markdownTokenName, parseMarkdown, renderMarkdown })` in `packages/webapp/src/components/TipTap/extensions/markdown-extensions.ts` continues to override at consumer level — `.extend()` always wins over base.

## 5. Plugin behavior fixes

### 5.1 `plugins/autolink.ts` (M5)

- Skip ranges that already carry the hyperlink mark: copy the `getMarksBetween(...).some(m => m.mark.type === options.type)` guard from `@tiptap/extension-link@3.22.4`.
- Skip ranges inside the `code` mark when present in the schema: `newState.doc.rangeHasMark(link.from, link.to, schema.marks.code)`.
- Replace `split(' ')` and `endsWith(' ')` with the official `UNICODE_WHITESPACE_REGEX` / `UNICODE_WHITESPACE_REGEX_END` patterns from `tiptap/packages/extension-link/src/helpers/whitespace.ts`. The regex constants are inlined into a new `src/utils/whitespace.ts` (single file, two exported `RegExp`s — no folder).
- Per-candidate filter order before `tr.addMark`, mirroring §3.4:
  1. `shouldAutoLink(url)` — bail if `false`.
  2. `isSafeHyperlinkHref(href, ctx)` — bail if `false`.
  3. `validate(href)` (legacy) — bail if `false`.

### 5.2 `plugins/clickHandler.ts` (M6)

- Bail out (return `false`, do not `preventDefault`) when any of:
  - `event.metaKey` (macOS Cmd-click)
  - `event.ctrlKey` (Linux/Windows Ctrl-click)
  - `event.button === 1` (middle-click)
  - `event.button !== 0` (any non-primary button)
- `window.open` calls always pass `'noopener,noreferrer'` as the third argument.
- Plugin `destroy()` calls `hideCurrentToolbar()` (B3).

### 5.3 `plugins/pasteHandler.ts`

- Apply `isSafeHyperlinkHref` to every candidate `href` before calling `setMark`.
- Pass `defaultProtocol` into `linkifyjs.find()`.

## 6. Popover layer

### 6.1 Accessibility (B2)

- Every icon-only `<button>` in `previewHyperlinkPopover.ts` (copy / edit / remove) gets an `aria-label`.
- Every `<input>` in `createHyperlinkPopover.ts` and `editHyperlinkPopover.ts` gets a real `<label>` (visually hidden via `.sr-only` class added to `styles.css`) or `aria-label` if structural label is impossible.
- Validation errors set `aria-invalid="true"` on the input, `aria-describedby` referencing the error message node, and the error node uses `role="alert"`.
- The `floatingToolbar` adds an `aria-label` (e.g. `"Hyperlink toolbar"`) so the toolbar role has an accessible name.
- A new shared helper `returnFocusToEditor(editor)` is added to `helpers/floatingToolbar.ts` and called on every dismiss path: Apply, Escape, outside-click, autoUpdate-loss. The popover layer's existing `onHide` callback becomes the dispatch point.

### 6.2 Lifecycle (B3)

- `clickHandler.destroy()` calls `hideCurrentToolbar()`.
- `Hyperlink.onDestroy` (new) also calls `hideCurrentToolbar()` as belt-and-suspenders.
- `floatingToolbar.setContent` removes existing `keydown` listeners on focusables before re-attaching new ones (collateral nit fix needed to avoid duplicate listeners after the lifecycle changes).

### 6.3 Verification

`cypress-axe` (added to `devDependencies` in PR 2 — see §8) is wired into `cypress/support/e2e.ts` via `import 'cypress-axe'`. A new spec `cypress/e2e/a11y.cy.ts` opens each popover state (preview, create, edit, error states) and runs `cy.injectAxe()` then `cy.checkA11y(null, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })`. CI fails on any violation.

## 7. Testing strategy

### 7.1 New / modified Cypress specs

| File                                     | Status     | Coverage                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cypress/e2e/xss-guards.cy.ts`           | **extend** | Add table-driven attack vectors: `file:///`, `blob:https://…`, `about:blank`, `chrome://settings`, `view-source:https://…`, `data:image/svg+xml,…`, `data:text/html;base64,…`, `https://user:pass@evil.com`, `JAVASCRIPT:alert(1)`, `javascript:alert(1)` (leading space), `vbscript:msgbox`. (T8) |
| `cypress/e2e/paste-policy.cy.ts`         | **NEW**    | Same input matrix run through autolink, paste, and `markPasteRule`; assert identical reject/normalize behavior. (T9)                                                                                                                                                                               |
| `cypress/e2e/undo-redo.cy.ts`            | **NEW**    | `Mod-Z` / `Mod-Shift-Z` after create, edit, autolink, paste-over-selection, remove-link. (T1)                                                                                                                                                                                                      |
| `cypress/e2e/ime.cy.ts`                  | **NEW**    | `compositionstart` → input → `compositionend` then assert autolink fires once. (T2)                                                                                                                                                                                                                |
| `cypress/e2e/multi-link.cy.ts`           | **NEW**    | Selection spans two adjacent links: `setHyperlink` and popover behavior. (T3)                                                                                                                                                                                                                      |
| `cypress/e2e/rich-paste.cy.ts`           | **NEW**    | Paste HTML with multiple `<a>` and `linkOnPaste` partial-selection edge cases. (T4)                                                                                                                                                                                                                |
| `cypress/e2e/mobile-touch.cy.ts`         | **NEW**    | Viewport `375×667`, `touchstart` / `touchend` on link → preview opens; outside-touch dismisses. (T5)                                                                                                                                                                                               |
| `cypress/e2e/preview-edit.cy.ts`         | **extend** | Stub `navigator.clipboard.writeText`; assert Copy button calls it with the correct href. (T6)                                                                                                                                                                                                      |
| `cypress/e2e/edit-popover-partial.cy.ts` | **NEW**    | Apply with only-text change, only-URL change, cancel without apply, Tab order. (T7)                                                                                                                                                                                                                |
| `cypress/e2e/a11y.cy.ts`                 | **NEW**    | `cy.checkA11y()` on each popover state.                                                                                                                                                                                                                                                            |

All `Mod+K` tests use:

```ts
const ModKey = Cypress.platform === 'darwin' ? 'Meta' : 'Control'
cy.realPress([ModKey, 'K'])
```

**M12 deferred:** `cypress/e2e/scroll-stickiness.cy.ts` keeps its `cy.wait(100)` / `cy.wait(200)` calls. Although M12 was originally classified as MAJOR, replacing the fixed waits requires either polling on Floating UI internals (brittle, version-coupled) or animation-frame loops (flaky in headless CI). The current waits have not been a source of flake in practice. Tracked as a follow-up with the cypress-axe spec; not blocking 2.0.

### 7.2 Unit tests (Bun)

- `src/utils/__tests__/isSafeHyperlinkHref.test.ts` — **NEW**: full denylist matrix, allowlist matrix, custom `protocols` injection, `isAllowedUri` callback precedence.
- Existing `validateURL.test.ts`, `normalizeHref.test.ts`, `specialUrls.test.ts`, `phone.test.ts` extended where relevant.

### 7.3 Coverage gate

Bun (≥1.3) supports inline coverage thresholds via `bunfig.toml`. A new `packages/extension-hyperlink/bunfig.toml` declares:

```toml
[test]
coverage = true
coverageReporter = ["text", "lcov"]
coverageThreshold = { line = 0.90 }
```

Path-level thresholds (validateURL ≥95%, normalizeHref ≥95%, hyperlink.ts ≥90%, plugins ≥85%) are enforced by a 30-line `scripts/check-coverage.ts` that parses the lcov output and exits non-zero on miss. CI runs `bun test --coverage` followed by `bun run scripts/check-coverage.ts`. No external coverage service.

## 8. Packaging & DX

| Item                                         | Action                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun-types: "latest"`                        | Pin to `catalog:` like the rest of the workspace. (M7)                                                                                                                     |
| `linkifyjs`                                  | Move from `dependencies` to `peerDependencies` (required, default `optional: false`). The webapp will need to add `linkifyjs` to its own dependencies in the same PR. (M8) |
| `@floating-ui/dom`                           | Stays as `dependencies`. The bundled UI is the default reason to install this package; consumers using their own UI tree-shake it via factory injection. (M8)              |
| `cypress-axe`                                | **NEW devDependency** for the a11y verification suite (§6.3).                                                                                                              |
| `publint`                                    | **NEW devDependency** for the publish gate.                                                                                                                                |
| `package.json#files`                         | Add `README.md`.                                                                                                                                                           |
| `prepublishOnly`                             | Extend `scripts/preflight.ts` to run `bunx publint dist/` and fail on any error.                                                                                           |
| README documented `normalizeLinkifyHref` row | **Remove** — internal helper, stays unexported. (B5)                                                                                                                       |

## 9. CI workflow

New file: `.github/workflows/extension-hyperlink.yml`

- Triggers: `pull_request` (paths: `packages/extension-hyperlink/**`), `push` to `main`.
- Job matrix: `ubuntu-latest`, Bun version pinned via `oven-sh/setup-bun@v2` reading workspace catalog.
- Steps:
  1. Checkout, setup Bun.
  2. `bun install --frozen-lockfile`.
  3. `bun run --filter @docs.plus/extension-hyperlink lint`.
  4. `bun run --filter @docs.plus/extension-hyperlink test:unit -- --coverage`.
  5. `bun run --filter @docs.plus/extension-hyperlink coverage:check` (path-level thresholds).
  6. `bun run --filter @docs.plus/extension-hyperlink build`.
  7. `bunx publint packages/extension-hyperlink/`.
  8. `bun run --filter @docs.plus/extension-hyperlink test:e2e` (uses existing `start-server-and-test` flow).
  9. On failure: upload `cypress/screenshots/**` and `cypress/videos/**` as workflow artifacts (debug aid).
- Branch protection on `main` requires this check.

## 10. README rewrite (B5 + M10)

New top-level structure:

1. Install
2. Quick start (StarterKit + Hyperlink)
3. Options reference (table — every option from §4.1, with the §3.4 precedence rules called out)
4. Commands reference (table — every command from §4.2)
5. Keyboard shortcuts (Mod-k behavior including no-popover degradation, §4.3)
6. Custom popovers (factory contract, exported type signatures: `CreateHyperlinkPopoverFactory`, `EditHyperlinkPopoverFactory`, `PreviewHyperlinkPopoverFactory`)
7. URL policy (denylist, allowlist, custom `protocols`, `isAllowedUri` callback)
8. Markdown integration (default + `Hyperlink.extend()` override pattern)
9. Migration from `@tiptap/extension-link`
10. Accessibility statement (WCAG 2.1 AA, verified via `cypress-axe` on every release)
11. Test files

Migration section content:

- `StarterKit.configure({ link: false })` — required.
- `npm i @docs.plus/extension-hyperlink` and `Hyperlink` extension.
- Options map table: `LinkOptions` → `HyperlinkOptions` (1:1 for shared options, called out for new ones).
- Command map table: `setLink` → `setHyperlink`, `unsetLink` → `unsetHyperlink`, `toggleLink` → `toggleHyperlink`.
- Stored-data note: stored docs using mark name `link` need either a JSON migration helper (one-paragraph snippet provided) **or** `Hyperlink.extend({ name: 'link' })` to keep the schema name.

## 11. Out-of-scope follow-ups

**The 11 nits** are tracked as low-priority issues, not part of this design:

N1 (duplicate keydown listeners — covered as collateral fix in §6.2), N2 (console noise), N3 (createHTMLElement JSDoc warning), N4 (long-URL truncation), N5 (i18n), N6 (split pretest), N7 (already covered as packaging item), N8 (README test-files table — covered by README rewrite), N9 (Cypress retries reconsider), N10 (50+ schemes wording — covered by README rewrite), N11 (normalizeHref vs autolink trailing punct).

**M12 (replace `cy.wait` in scroll-stickiness)** is deferred per §7.1 rationale.

## 12. Implementation sequencing

Implementation happens in a sibling worktree at `../docsy-extension-hyperlink-2.0` on branch `feat/extension-hyperlink-2.0`. Three PRs, each one merge-ready and shippable on its own (the existing `setHyperlink` popover behavior stays intact through PR 1, and is only refactored in PR 2 alongside the webapp call-site updates).

### 12.1 PR breakdown

| PR                                           | Title                                                                                                                                | Items                                                                                                                           | Notes                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PR 1 — Safety + parity foundations**       | URL policy, plugin fixes, packaging hygiene, CI bootstrap                                                                            | B1, B4, B5, M1, M5, M6, M7, M8, M9, **M11**, T8, T9, ESLint seam rule, publint gate                                             | M11 (platform-aware Mod key helper) lands here so all subsequent tests use the right pattern from day one.                                       |
| **PR 2 — Command surface, markdown, a11y**   | `setHyperlink` refactor, new commands, markdown defaults, popover a11y, lifecycle teardown, axe-core, **webapp call-site migration** | B2, B3, M2, M3, M4, T2, T3, T4, T6, T7, a11y.cy.ts, webapp `setHyperlink()` → `openCreateHyperlinkPopover()` (4 files per §4.4) | Webapp updates ship in the same PR as the breaking command-API change. CI runs the webapp test suite as part of merge gate to catch regressions. |
| **PR 3 — Coverage + remaining tests + docs** | Remaining tests, coverage gate enforcement, README rewrite + migration section                                                       | T1, T5, M10, coverage threshold, WCAG verification audit                                                                        | No new code paths — purely raising the bar.                                                                                                      |

### 12.2 Cross-PR invariants

- **Every PR is green on the CI workflow added in PR 1** (lint + unit + coverage check + build + publint + Cypress).
- **No PR removes a public API in a way that breaks the webapp** without updating the webapp in the same PR. PR 2 is the only PR with cross-package changes; PR 1 and PR 3 are extension-local.
- Each PR includes a CHANGELOG entry (manually authored in `packages/extension-hyperlink/CHANGELOG.md`) following keep-a-changelog format.

Estimated effort: ~5 working days total.

## 13. Anti-overengineering checklist

The following ceremony was explicitly considered and **cut**:

- ✗ Folder restructure into `core/`, `ui/`, `url-policy/` namespaces.
- ✗ Splitting into two npm packages.
- ✗ A new `url-policy` module — the function lives inside the existing `validateURL.ts`.
- ✗ Typedoc / generated docs site.
- ✗ `arethetypeswrong` (publint covers it).
- ✗ Changesets / release-please.
- ✗ State machine or plugin abstraction layer in the popovers.
- ✗ Visual regression suite.
- ✗ A new whitespace utility folder — two `RegExp` constants live in a single new file `src/utils/whitespace.ts`.
- ✗ Renaming the schema mark.
- ✗ Wholesale rewrite of `linkifyjs` integration.

---

**Approval:** This design was approved by the project lead on 2026-04-21 in chat session.
**Next step:** Create the worktree, run the writing-plans skill, produce 3 implementation plan files in `docs/superpowers/plans/`.
