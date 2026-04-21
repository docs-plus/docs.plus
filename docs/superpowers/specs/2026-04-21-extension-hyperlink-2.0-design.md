# `@docs.plus/extension-hyperlink` 2.0 GA — Design Spec

**Status:** Approved 2026-04-21
**Owner:** docs.plus core team
**Implementation worktree:** `../docsy-extension-hyperlink-2.0` on branch `feat/extension-hyperlink-2.0`
**Source review:** see parallel agent reports summarized in the chat dated 2026-04-21.

---

## 1. Goals

1. Ship `@docs.plus/extension-hyperlink@2.0.0` as a production-ready Tiptap 3 mark extension.
2. Close every blocker, major, and test-gap item from the multi-agent code review (27 items; the 11 nits are explicitly out of scope).
3. Meet the following industry-standard quality flags:
   - **publint** clean on every publish.
   - **WCAG 2.1 AA** verified via `cypress-axe` on every popover flow.
   - **≥90% line coverage** on the URL-policy and core mark code paths.
   - **Conventional Commits** in commit messages (commitlint already exists at repo root).
   - **Accurate README** including a migration section from `@tiptap/extension-link`.
4. Zero data migration for docs.plus production: the schema mark name `hyperlink` is preserved.

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

`isSafeHyperlinkHref` is called at every write site:

| Site                                  | File                                  | Why                                                                        |
| ------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `setMark` chain inside `setHyperlink` | `hyperlink.ts`                        | Programmatic call protection                                               |
| `parseHTML.getAttrs`                  | `hyperlink.ts`                        | Untrusted HTML import                                                      |
| `renderHTML`                          | `hyperlink.ts`                        | Defense in depth — strip bad `href` from output even if state was tampered |
| `pasteHandler`                        | `plugins/pasteHandler.ts`             | User paste                                                                 |
| `markPasteRule` (markdown `[t](u)`)   | `hyperlink.ts`                        | Markdown autolinking                                                       |
| `autolink`                            | `plugins/autolink.ts`                 | Typed-text autolink                                                        |
| `clickHandler` navigation             | `plugins/clickHandler.ts`             | `window.open` gate                                                         |
| Preview popover render                | `popovers/previewHyperlinkPopover.ts` | Display-time gate                                                          |

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

`Mod-k` runs `openCreateHyperlinkPopover()` if a popover factory is configured, else `setHyperlink({ href: '' })` is intentionally a no-op (the mark cannot apply without a valid `href`). Documented in README.

### 4.4 Mark schema additions

- `exitable: true` (M3 — Tiptap-Link parity).
- `target` attribute: remove `rendered: false` so the attribute round-trips through `renderHTML` correctly (M9). Snapshot test covers parse → render fidelity.
- Default `markdownTokenName: 'link'`, default `parseMarkdown` and `renderMarkdown` (M3). Webapp's `Hyperlink.extend({ markdownTokenName, parseMarkdown, renderMarkdown })` continues to override at consumer level.

## 5. Plugin behavior fixes

### 5.1 `plugins/autolink.ts` (M5)

- Skip ranges that already carry the hyperlink mark: copy the `getMarksBetween(...).some(m => m.mark.type === options.type)` guard from `@tiptap/extension-link@3.22.4`.
- Skip ranges inside the `code` mark when present in the schema: `newState.doc.rangeHasMark(link.from, link.to, schema.marks.code)`.
- Replace `split(' ')` and `endsWith(' ')` with the official `UNICODE_WHITESPACE_REGEX` / `UNICODE_WHITESPACE_REGEX_END` patterns from `tiptap/packages/extension-link/src/helpers/whitespace.ts`. The regex constants are inlined into a new `src/utils/whitespace.ts` (single file, two exported `RegExp`s — no folder).
- Apply `isSafeHyperlinkHref` before `tr.addMark`.

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

`cypress-axe` is wired into `cypress/support/e2e.ts`. A new spec `cypress/e2e/a11y.cy.ts` opens each popover state and runs `cy.checkA11y()` with WCAG 2.1 AA rules. CI fails on any violation.

## 7. Testing strategy

### 7.1 New / modified Cypress specs

| File                                     | Status     | Coverage                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cypress/e2e/xss-guards.cy.ts`           | **extend** | Add table-driven attack vectors: `file:///`, `blob:https://…`, `about:blank`, `chrome://settings`, `view-source:https://…`, `data:image/svg+xml,…`, `data:text/html;base64,…`, `https://user:pass@evil.com`, `JAVASCRIPT:alert(1)`, ` javascript:alert(1)` (leading space), `vbscript:msgbox`. (T8) |
| `cypress/e2e/paste-policy.cy.ts`         | **NEW**    | Same input matrix run through autolink, paste, and `markPasteRule`; assert identical reject/normalize behavior. (T9)                                                                                                                                                                                |
| `cypress/e2e/undo-redo.cy.ts`            | **NEW**    | `Mod-Z` / `Mod-Shift-Z` after create, edit, autolink, paste-over-selection, remove-link. (T1)                                                                                                                                                                                                       |
| `cypress/e2e/ime.cy.ts`                  | **NEW**    | `compositionstart` → input → `compositionend` then assert autolink fires once. (T2)                                                                                                                                                                                                                 |
| `cypress/e2e/multi-link.cy.ts`           | **NEW**    | Selection spans two adjacent links: `setHyperlink` and popover behavior. (T3)                                                                                                                                                                                                                       |
| `cypress/e2e/rich-paste.cy.ts`           | **NEW**    | Paste HTML with multiple `<a>` and `linkOnPaste` partial-selection edge cases. (T4)                                                                                                                                                                                                                 |
| `cypress/e2e/mobile-touch.cy.ts`         | **NEW**    | Viewport `375×667`, `touchstart` / `touchend` on link → preview opens; outside-touch dismisses. (T5)                                                                                                                                                                                                |
| `cypress/e2e/preview-edit.cy.ts`         | **extend** | Stub `navigator.clipboard.writeText`; assert Copy button calls it with the correct href. (T6)                                                                                                                                                                                                       |
| `cypress/e2e/edit-popover-partial.cy.ts` | **NEW**    | Apply with only-text change, only-URL change, cancel without apply, Tab order. (T7)                                                                                                                                                                                                                 |
| `cypress/e2e/a11y.cy.ts`                 | **NEW**    | `cy.checkA11y()` on each popover state.                                                                                                                                                                                                                                                             |

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

`bun test --coverage --coverage-reporter=lcov` runs in CI. Threshold gate enforces:

- `src/utils/validateURL.ts`: ≥95% lines
- `src/utils/normalizeHref.ts`: ≥95% lines
- `src/hyperlink.ts`: ≥90% lines
- `src/plugins/**`: ≥85% lines

Threshold check is a small node script in CI that parses the lcov report and exits non-zero on miss.

## 8. Packaging & DX

| Item                                         | Action                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun-types: "latest"`                        | Pin to `catalog:` like the rest of the workspace. (M7)                                                                                                        |
| `linkifyjs`                                  | Move from `dependencies` to `peerDependencies` (apps often already ship it). Add `peerDependenciesMeta.linkifyjs.optional = false`. (M8)                      |
| `@floating-ui/dom`                           | Stays as `dependencies`. The bundled UI is the default reason to install this package; consumers using their own UI tree-shake it via factory injection. (M8) |
| `package.json#files`                         | Add `README.md`.                                                                                                                                              |
| `prepublishOnly`                             | Extend `scripts/preflight.ts` to run `bunx publint dist/` and fail on any error.                                                                              |
| README documented `normalizeLinkifyHref` row | **Remove** — internal helper, stays unexported. (B5)                                                                                                          |

## 9. CI workflow

New file: `.github/workflows/extension-hyperlink.yml`

- Triggers: `pull_request` (paths: `packages/extension-hyperlink/**`), `push` to `main`.
- Job matrix: `ubuntu-latest`, Bun version pinned via `oven-sh/setup-bun@v2` reading workspace catalog.
- Steps:
  1. Checkout, setup Bun.
  2. `bun install --frozen-lockfile`.
  3. `bun run --filter @docs.plus/extension-hyperlink lint`.
  4. `bun run --filter @docs.plus/extension-hyperlink test:unit -- --coverage`.
  5. Coverage threshold check (parses lcov).
  6. `bun run --filter @docs.plus/extension-hyperlink build`.
  7. `bunx publint packages/extension-hyperlink/`.
  8. `bun run --filter @docs.plus/extension-hyperlink test:e2e` (uses existing `start-server-and-test` flow).
- Branch protection on `main` requires this check.

## 10. README rewrite (B5 + M10)

New top-level structure:

1. Install
2. Quick start (StarterKit + Hyperlink)
3. Options reference (table — every option from §4.1)
4. Commands reference (table — every command from §4.2)
5. Custom popovers (factory contract, type signatures)
6. URL policy (denylist, allowlist, `isAllowedUri` callback)
7. Markdown integration (default + how to override)
8. Migration from `@tiptap/extension-link`
9. Accessibility statement (WCAG 2.1 AA)
10. Test files

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

Implementation happens in a sibling worktree at `../docsy-extension-hyperlink-2.0` on branch `feat/extension-hyperlink-2.0`, in **3 PRs**:

| PR                                           | Title                                                                                                  | Items                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **PR 1 — Safety + parity foundations**       | URL policy, plugin fixes, packaging hygiene, CI bootstrap                                              | B1, B4, B5, M1, M5, M6, M7, M8, M9, T8, T9, ESLint seam rule, publint gate |
| **PR 2 — Command surface, markdown, a11y**   | `setHyperlink` refactor, new commands, markdown defaults, popover a11y, lifecycle teardown, axe-core   | B2, B3, M2, M3, M4, T2, T3, T4, T6, T7                                     |
| **PR 3 — Coverage + remaining tests + docs** | Remaining tests, coverage gate enforcement, README rewrite + migration section, platform-aware Mod key | T1, T5, M10, M11, coverage threshold, WCAG verification suite              |

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
