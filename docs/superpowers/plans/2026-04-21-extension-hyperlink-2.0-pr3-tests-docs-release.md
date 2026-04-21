# Extension-Hyperlink 2.0 — PR 3: Coverage, docs, release

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining test gaps (undo/redo, mobile/touch), rewrite the README around the 2.0 surface with a migration cookbook from `@tiptap/extension-link`, and prepare the package for the 2.0.0 GA release.

**Spec:** `/Users/macbook/workspace/docsy/docs/superpowers/specs/2026-04-21-extension-hyperlink-2.0-design.md`

**Branch:** continue on `feat/extension-hyperlink-2.0` (same worktree).

**Depends on:** PRs 1 + 2 merged (or stacked) on the same branch.

---

## Task 0: Sync worktree

**Files:** none

- [ ] **Step 1: Rebase / install / verify**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
git fetch origin
git rebase origin/main
bun install --frozen-lockfile
bun run --filter @docs.plus/extension-hyperlink lint
bun run --filter @docs.plus/extension-hyperlink test:unit:coverage
bun run --filter @docs.plus/extension-hyperlink build
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green.

---

## Task 1: Test gap — undo/redo coverage (T1)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/undo-redo.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
import { pressMod } from '../support/keyboard'

describe('undo/redo coverage (T1)', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.get('#editor').click()
  })

  it('undo removes a link created via the popover', () => {
    cy.get('#editor').type('select me{selectall}')
    pressMod('K')
    cy.get('.hyperlink-create-popover input').type('https://example.com{enter}')
    cy.get('#editor a').should('have.length', 1)
    pressMod('Z')
    cy.get('#editor a').should('not.exist')
    cy.get('#editor').should('contain.text', 'select me')
  })

  it('redo re-applies the link', () => {
    cy.get('#editor').type('select me{selectall}')
    pressMod('K')
    cy.get('.hyperlink-create-popover input').type('https://example.com{enter}')
    pressMod('Z')
    pressMod(['Shift', 'Z'])
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
  })

  it('undo removes an autolinked URL', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').should('have.length', 1)
    pressMod('Z')
    // Autolink is one transaction step on top of the typing — one
    // undo should peel only the autolink mark off the still-typed text.
    cy.get('#editor a').should('not.exist')
    cy.get('#editor').should('contain.text', 'https://example.com')
  })

  it('undo restores a removed link via unsetHyperlink', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover [aria-label="Remove link"]').click()
    cy.get('#editor a').should('not.exist')
    pressMod('Z')
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
  })

  it('undo restores a paste-over-selection link', () => {
    cy.get('#editor').type('hello world{selectall}')
    cy.window().then((win) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'https://example.com')
      win._editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
    })
    cy.get('#editor a').should('have.length', 1)
    pressMod('Z')
    cy.get('#editor a').should('not.exist')
    cy.get('#editor').should('contain.text', 'hello world')
  })

  it('undo restores text edited via editHyperlinkText', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover [aria-label="Edit link"]').click()
    cy.get('.hyperlink-edit-popover input[name="hyperlink-text"]').clear().type('renamed{enter}')
    cy.get('#editor a').should('have.text', 'renamed')
    pressMod('Z')
    cy.get('#editor a').should('have.text', 'https://example.com')
  })
})
```

If the spec exposes a real defect (e.g. autolink takes two undos because it's a separate transaction the user didn't expect), open a sub-issue and document the failure in `cypress/e2e/undo-redo.cy.ts` with a `describe.skip(..., 'expected behavior, see #issue')` block — do **not** silently paper over it with `tr.setMeta('addToHistory', false)`, which would make autolink completely un-undoable and is almost always the wrong fix. The right answer depends on whether one-undo-clears-link or two-undos (one for link, one for text) is the intended UX, which is a product decision worth making explicit.

- [ ] **Step 2: Run and commit**

```bash
bun run test:e2e -- --spec cypress/e2e/undo-redo.cy.ts
git add packages/extension-hyperlink/cypress/e2e/undo-redo.cy.ts
git commit -m "test(extension-hyperlink): undo/redo across all entry paths (T1)"
```

---

## Task 2: Test gap — touch / mobile viewport (T5)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/mobile-touch.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
describe('touch + mobile viewport (T5)', () => {
  beforeEach(() => {
    cy.viewport('iphone-x')
    cy.visitPlayground()
    cy.get('#editor').click()
  })

  it('touchend on a link opens preview popover', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a')
      .first()
      .then(($a) => {
        const rect = $a[0].getBoundingClientRect()
        $a[0].dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            changedTouches: [
              new Touch({
                identifier: 0,
                target: $a[0],
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              })
            ]
          })
        )
      })
    cy.get('.hyperlink-preview-popover').should('be.visible')
  })

  it('touchstart outside the popover closes it', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover').should('be.visible')

    cy.get('body').then(($body) => {
      $body[0].dispatchEvent(
        new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            new Touch({
              identifier: 0,
              target: $body[0],
              clientX: 10,
              clientY: 10
            })
          ]
        })
      )
    })
    cy.get('.hyperlink-preview-popover').should('not.exist')
  })

  it('floating toolbar repositions on viewport scroll', () => {
    cy.get('#editor').type(
      // Force enough content to scroll.
      'padding\n'.repeat(20) + 'https://example.com '
    )
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover').then(($p) => {
      const before = $p[0].getBoundingClientRect().top
      cy.scrollTo(0, 100)
      cy.get('.hyperlink-preview-popover').then(($p2) => {
        const after = $p2[0].getBoundingClientRect().top
        // Expect the popover to have followed (or hidden) — anything
        // other than "stuck at the same coords" passes the spirit
        // of scroll-stickiness.
        expect(after).not.to.equal(before)
      })
    })
  })

  it('host can opt out of floating-toolbar (factory returns null) and editor stays focused', () => {
    cy.window().then((win) => {
      // Reconfigure to return null from the preview factory.
      win._editor.extensionManager.extensions.find(
        (e: any) => e.name === 'hyperlink'
      ).options.popovers.previewHyperlink = () => null
    })
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover').should('not.exist')
    cy.focused().should('have.attr', 'contenteditable', 'true')
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
bun run test:e2e -- --spec cypress/e2e/mobile-touch.cy.ts
git add packages/extension-hyperlink/cypress/e2e/mobile-touch.cy.ts
git commit -m "test(extension-hyperlink): touch + mobile-viewport behavior (T5)"
```

---

## Task 3: Raise the workspace coverage gate (optional)

**Files:**

- Modify: `packages/extension-hyperlink/bunfig.toml` (only if there is real headroom)

PR 1 + PR 2 ship a meaningful pile of new unit tests. After all that lands, line coverage will likely sit comfortably above the `0.85` floor in `bunfig.toml`. This task is the only place to consider raising it.

- [ ] **Step 1: Read the actual number**

```bash
cd packages/extension-hyperlink
bun run test:unit:coverage
```

Read the bottom-line line-coverage percentage.

- [ ] **Step 2: Raise the floor only if there's genuine headroom**

Heuristic: floor = `floor(actual * 100) / 100 - 0.02` (rounded down with a 2-point cushion so a small refactor doesn't trip the gate).

- Actual `0.92` → set floor to `0.90`.
- Actual `0.86` → leave at `0.85`.
- Actual below `0.85` → it's a regression in PR 1 / PR 2; fix the gap with a real test, do **not** lower the floor.

If raising the floor, edit `bunfig.toml`:

```toml
[test]
coverageThreshold = { line = 0.90 }
```

- [ ] **Step 3: Re-run, then commit (if changed)**

```bash
bun run test:unit:coverage
```

```bash
git add packages/extension-hyperlink/bunfig.toml
git commit -m "test(extension-hyperlink): raise coverage floor to <X>%

PR 1 + PR 2's new unit tests (validateURL, isSafeHyperlinkHref,
renderRoundTrip, attack-vector matrix, paste-policy parity) put us
well above the original 0.85 floor. Tighten the gate to <X>% with
a 2-point cushion."
```

If no change is warranted, skip the commit and move on.

---

## Task 4: README rewrite (M10)

**Files:**

- Modify: `packages/extension-hyperlink/README.md`

The current README documents a 1.x API and references a non-exported helper. Rewrite around the 2.0 surface with a clear migration story from `@tiptap/extension-link`.

- [ ] **Step 1: Replace the entire README**

The new README has the following sections in order. Use the existing badge block at the top if present; otherwise omit.

````markdown
# @docs.plus/extension-hyperlink

Production-grade hyperlink extension for Tiptap 3 — a drop-in replacement for `@tiptap/extension-link` with extra UX, accessibility, and security defaults baked in.

## Why this exists

`@tiptap/extension-link` is a great primitive but stops at "render an `<a>` mark". Real document editors need:

- A **create**/**edit**/**preview** popover layer that doesn't lock you into one design system (pluggable factories).
- **Strict URL safety** at every write site (parseHTML, paste, autolink, render) — single denylist, single function, no surprises.
- **Tiptap-Link parity** for every option (`defaultProtocol`, `isAllowedUri`, `protocols`, `enableClickSelection`, `shouldAutoLink`, `autolink`, `linkOnPaste`, `openOnClick`).
- **WCAG 2.1 AA** popovers out of the box (labels, aria-invalid + aria-describedby, focus restoration).
- A robust **autolink** that respects code spans, NBSP whitespace, and never double-links.
- **CI gates**: lint, unit + coverage thresholds, build, publint, Cypress, axe.

If you only need the mark and don't want any UI, set `popovers: { createHyperlink: null, previewHyperlink: null }` and you have a strict superset of `@tiptap/extension-link`.

## Install

\`\`\`bash
bun add @docs.plus/extension-hyperlink @floating-ui/dom linkifyjs

# or npm / pnpm — linkifyjs is a peer dependency, install it explicitly.

\`\`\`

## Quick start

\`\`\`ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
Hyperlink,
createHyperlinkPopover,
previewHyperlinkPopover
} from '@docs.plus/extension-hyperlink'

const editor = new Editor({
extensions: [
StarterKit.configure({ link: false }), // disable the default Link
Hyperlink.configure({
defaultProtocol: 'https',
popovers: {
createHyperlink: createHyperlinkPopover,
previewHyperlink: previewHyperlinkPopover
}
})
]
})
\`\`\`

## Options

| Option                      | Type                                           | Default                                                              | Notes                                                               |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `autolink`                  | `boolean`                                      | `true`                                                               | Auto-link URLs as the user types.                                   |
| `linkOnPaste`               | `boolean`                                      | `true`                                                               | Linkify pasted URLs over a non-empty selection.                     |
| `openOnClick`               | `boolean`                                      | `true`                                                               | Open links on click (opens preview popover when one is configured). |
| `enableClickSelection`      | `boolean`                                      | `false`                                                              | Extend selection through the link on click.                         |
| `protocols`                 | `Array<string \| { scheme, optionalSlashes }>` | `[]`                                                                 | Custom schemes registered with linkifyjs.                           |
| `defaultProtocol`           | `string`                                       | `'https'`                                                            | Used when normalizing bare-domain hrefs.                            |
| `shouldAutoLink`            | `(url) => boolean`                             | `() => true`                                                         | Per-candidate gate before the safety layer.                         |
| `validate`                  | `(url) => boolean`                             | `undefined`                                                          | Legacy hook — runs after the safety layer accepts.                  |
| `isAllowedUri`              | `(href, ctx) => boolean`                       | `undefined`                                                          | Override the entire URL-policy decision. Highest precedence.        |
| `HTMLAttributes`            | `Partial<HyperlinkAttributes>`                 | `{ rel: 'noopener noreferrer nofollow', target: null, class: null }` | Default mark attributes.                                            |
| `popovers.createHyperlink`  | factory \| `null`                              | `null`                                                               | Returns the create-UI element. `null` disables popover.             |
| `popovers.previewHyperlink` | factory \| `null`                              | `null`                                                               | Returns the preview/edit UI element.                                |
| `markdownTokenName`         | `string`                                       | `'link'`                                                             | Token name for the markdown pipeline.                               |

## Commands

| Command                                                | Behavior                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `setHyperlink({ href, target? })`                      | Pure mark write. Rejects unsafe hrefs. **No UI side effect.**          |
| `toggleHyperlink({ href, target? })`                   | Toggle the mark on the current selection.                              |
| `unsetHyperlink()`                                     | Remove the mark from the selection (extends through empty mark range). |
| `editHyperlink({ newText?, newURL?, title?, image? })` | Replace text and/or attrs of the link at the selection.                |
| `editHyperlinkText(text)`                              | Sugar for text-only edit.                                              |
| `editHyperlinkHref(href)`                              | Sugar for href-only edit.                                              |
| `openCreateHyperlinkPopover(attrs?)`                   | Open the create UI (no-op when no factory configured).                 |
| `openEditHyperlinkPopover()`                           | Open the edit/preview UI for the link at the cursor.                   |

## Keyboard shortcuts

| Shortcut                         | Action                                                            |
| -------------------------------- | ----------------------------------------------------------------- |
| `Mod-K`                          | Open create popover (or edit popover if cursor is inside a link). |
| `Esc` (in popover)               | Dismiss popover, return focus to editor.                          |
| `Tab` / `Shift-Tab` (in popover) | Cycle through focusable elements.                                 |

## URL policy

Every place the extension writes an `href` runs through a single function: `isSafeHyperlinkHref(href, ctx)`. Precedence:

1. **Denylist** (always wins unless `isAllowedUri` overrides):
   `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `about:`, `chrome:`, `view-source:`. Embedded credentials (`https://user:pass@host`) also rejected.
2. **`isAllowedUri(href, ctx)`** — if defined, its return value is final. Use this to override either direction.
3. **Built-in allowlist** — `http`, `https`, `mailto`, `tel`, `sms`, `ftp`, `ftps`, `geo`.
4. **Special-scheme catalog** — `whatsapp:`, `wa.me/*`, etc. (see `src/utils/specialUrls.ts`).
5. **Custom `protocols`** — schemes you registered via the option.
6. **Legacy `validate(url)`** — runs _after_ the safety layer accepts, can additionally reject on business rules. Cannot accept what the safety layer rejected.

The same policy applies to `parseHTML`, `renderHTML`, `setHyperlink`, `toggleHyperlink`, the input rule, `markPasteRule`, `pasteHandler`, `autolink`, and click navigation. Audit once, trust everywhere.

## Custom popover factories

The extension is decoupled from any specific UI framework. A popover is a function that returns an `HTMLElement` (or `null` to opt out):

\`\`\`ts
import type { CreateHyperlinkOptions, PreviewHyperlinkOptions } from '@docs.plus/extension-hyperlink'

const myCreateFactory = (opts: CreateHyperlinkOptions): HTMLElement | null => {
// Build your own DOM. Call opts.editor.commands.setHyperlink({ href })
// to apply, opts.validate(href) for legacy validation, and dismiss
// by calling hideCurrentToolbar() (or returning null up-front to let
// the host render its own UI — e.g. a mobile bottom sheet).
}
\`\`\`

Returning `null` from a factory is the contract for "I'm rendering my own UI" — the extension will not attach a floating toolbar in that case.

## Markdown integration

By default the extension serializes/parses as the standard markdown link (`[text](url)`). The only exposed knob is the token name used by your markdown serializer:

\`\`\`ts
Hyperlink.configure({
markdownTokenName: 'link' // default — change if your serializer emits a different token
})
\`\`\`

If you need custom parse/render behavior, extend the mark in your serializer layer:

\`\`\`ts
Hyperlink.extend({
parseMarkdown(token) { /_ … _/ },
renderMarkdown(attrs, text) { /_ … _/ }
})
\`\`\`

When extending via `Hyperlink.extend({ ... })`, the override takes precedence (per Tiptap option resolution). The webapp's `markdown-extensions.ts` does exactly this.

## Migration from `@tiptap/extension-link`

| `@tiptap/extension-link`                    | `@docs.plus/extension-hyperlink`                             | Notes                                                             |
| ------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `import Link from '@tiptap/extension-link'` | `import { Hyperlink } from '@docs.plus/extension-hyperlink'` | Mark name changes from `link` to `hyperlink`.                     |
| `.configure({ ... })`                       | `.configure({ ... })`                                        | All Tiptap-Link options work; some have richer types.             |
| `setLink({ href })`                         | `setHyperlink({ href })`                                     | Argument is now required. Pure mark write — does **not** open UI. |
| `toggleLink({ href })`                      | `toggleHyperlink({ href })`                                  | Same semantics.                                                   |
| `unsetLink()`                               | `unsetHyperlink()`                                           | Same semantics.                                                   |
| n/a (only the mark)                         | `openCreateHyperlinkPopover(attrs?)`                         | Explicit way to open the create UI.                               |
| n/a                                         | `openEditHyperlinkPopover()`                                 | Explicit way to open the edit UI.                                 |
| Enable in `StarterKit`                      | `StarterKit.configure({ link: false })` then add `Hyperlink` | Avoid both marks active in the same schema.                       |
| `isAllowedUri(url, ctx)`                    | `isAllowedUri(href, ctx)`                                    | Same shape, same precedence.                                      |
| `defaultProtocol`                           | `defaultProtocol`                                            | Same.                                                             |
| `protocols`                                 | `protocols`                                                  | Same.                                                             |
| `enableClickSelection`                      | `enableClickSelection`                                       | Same.                                                             |
| `shouldAutoLink`                            | `shouldAutoLink`                                             | Same.                                                             |

If you maintain a markdown serializer that emits `link` tokens, the default `markdownTokenName` is `'link'` so most pipelines work without changes.

## Accessibility

The bundled popovers meet **WCAG 2.1 AA**:

- Every input has a `<label>` (visually hidden by default, available to screen readers).
- Validation errors use `role="alert"` + `aria-live="polite"` + `aria-invalid` + `aria-describedby`.
- Icon-only buttons (Copy, Edit, Remove) have `aria-label`.
- Decorative icons have `aria-hidden="true"`.
- Focus returns to the editor (or the previously-focused element) on every dismiss path: Apply, Escape, outside-click.
- Keyboard-only operation supported: `Tab` / `Shift-Tab` cycles, `Esc` dismisses.

The `cypress-axe` job in CI runs the WCAG 2.1 AA rule set against every popover state. A new violation fails the build.

## Files

| Path                                                    | Purpose                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/hyperlink.ts`                                      | Mark extension definition.                                                               |
| `src/plugins/autolink.ts`                               | Autolink plugin.                                                                         |
| `src/plugins/clickHandler.ts`                           | Open preview popover / `window.open` on click.                                           |
| `src/plugins/pasteHandler.ts`                           | Linkify paste over selection.                                                            |
| `src/popovers/{create,edit,preview}HyperlinkPopover.ts` | Bundled UI factories.                                                                    |
| `src/helpers/floatingToolbar.ts`                        | `@floating-ui/dom` wrapper used by all popovers.                                         |
| `src/helpers/openCreatePopover.ts`                      | Opens create popover (called by `openCreateHyperlinkPopover` command).                   |
| `src/helpers/openEditPopover.ts`                        | Opens edit popover (called by `openEditHyperlinkPopover` command and by `clickHandler`). |
| `src/utils/validateURL.ts`                              | URL safety policy (`isSafeHyperlinkHref`, `validateURL`, `DANGEROUS_SCHEME_RE`).         |
| `src/utils/normalizeHref.ts`                            | href canonicalization (bare-domain → `https://`).                                        |
| `src/utils/specialUrls.ts`                              | Special-scheme catalog (whatsapp, t.me, etc.).                                           |
| `src/utils/phone.ts`                                    | E.164 phone-number recognition for `tel:` links.                                         |
| `src/utils/a11y.ts`                                     | A11y helpers (`makeLabeledInput`, `labelIconButton`).                                    |
| `src/utils/whitespace.ts`                               | Unicode whitespace regex used by autolink.                                               |
| `cypress/e2e/*.cy.ts`                                   | E2E tests. See [test files](#test-files).                                                |

## Test files

| Spec                         | Covers                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| `autolink.cy.ts`             | Autolink on type, trailing punctuation, scheme prefixes.    |
| `create.cy.ts`               | Create popover via Mod-K + form submit.                     |
| `preview-edit.cy.ts`         | Click → preview, edit, copy.                                |
| `xss-guards.cy.ts`           | XSS attack-vector matrix (T8).                              |
| `paste-policy.cy.ts`         | Policy parity across paste / markPasteRule / autolink (T9). |
| `a11y.cy.ts`                 | WCAG 2.1 AA via cypress-axe (B2).                           |
| `ime.cy.ts`                  | IME composition (T2).                                       |
| `multi-link.cy.ts`           | Selections spanning multiple links (T3).                    |
| `rich-paste.cy.ts`           | Rich HTML paste with multiple links (T4).                   |
| `mobile-touch.cy.ts`         | Touch + mobile viewport (T5).                               |
| `undo-redo.cy.ts`            | Undo/redo across all entry paths (T1).                      |
| `edit-popover-partial.cy.ts` | Edit popover only-text / only-URL / cancel (T7).            |
| `scroll-stickiness.cy.ts`    | Floating toolbar follows scroll.                            |
| `special-schemes.cy.ts`      | Special-scheme catalog (whatsapp, mailto, tel, etc.).       |

## License

MIT — see LICENSE.
\`\`\`

- [ ] **Step 2: Verify the README is internally consistent**

```bash
rg "normalizeLinkifyHref|setHyperlink\(\)" packages/extension-hyperlink/README.md
```
````

Expected: no matches (the deprecated helper and the no-arg `setHyperlink` should not be referenced).

- [ ] **Step 3: Add README to the `files` allowlist**

In `packages/extension-hyperlink/package.json`, ensure `files` contains `"README.md"`:

```json
"files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"]
```

- [ ] **Step 4: Build, run publint to verify**

```bash
bun run --filter @docs.plus/extension-hyperlink build
cd packages/extension-hyperlink && bunx publint --strict .
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/README.md packages/extension-hyperlink/package.json
git commit -m "docs(extension-hyperlink): rewrite README for 2.0 (M10)

New README maps directly to the 2.0 surface:
- Why-this-exists framing vs @tiptap/extension-link.
- Full options table including PR 1 + PR 2 additions.
- Commands table including the split setHyperlink /
  openCreateHyperlinkPopover / openEditHyperlinkPopover.
- URL policy section explaining the §3.4 precedence ladder.
- Custom popover factory contract.
- Markdown integration defaults.
- Migration cookbook from @tiptap/extension-link with a row-by-row
  mapping (StarterKit { link: false }, command renames, option
  parity).
- WCAG 2.1 AA accessibility statement.
- Per-file purpose table and a per-spec coverage table.

Adds README.md to package.json files allowlist (was only dist /
CHANGELOG / LICENSE)."
```

---

## Task 5: CHANGELOG — finalize the existing `[2.0.0]` entry for release

**Files:**

- Modify: `packages/extension-hyperlink/CHANGELOG.md`

> Note: there is **no** `[Unreleased]` header to promote. The CHANGELOG already has a `## [2.0.0] — 2026-04-20` entry that PRs 1 and 2 amended in place. PR 3 adds its own items to the same entry, then optionally bumps the date if the release lands on a different day.

- [ ] **Step 1: Sanity check the CHANGELOG state**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
node -p "require('./packages/extension-hyperlink/package.json').version"
rg -n '^## \[' packages/extension-hyperlink/CHANGELOG.md
```

Expected:

- Version: `2.0.0` (do not bump — it was already 2.0.0 on `main`).
- Exactly **one** `## [2.0.0]` header in the CHANGELOG (no `[Unreleased]`, no duplicate `[2.0.0]`). If two `[2.0.0]` headers exist, PR 1 or PR 2 created a duplicate instead of amending — fix that first by merging the new entry into the existing one and deleting the duplicate.

- [ ] **Step 2: Add PR 3's items into the existing `[2.0.0]` entry**

Edit `packages/extension-hyperlink/CHANGELOG.md` and slot the following into the matching subsections of the existing `## [2.0.0] — 2026-04-20` entry:

```markdown
### Internal (additions from PR 3)

- **T1** New `undo-redo.cy.ts` covering create / autolink / unset / paste / edit-text via undo + redo.
- **T5** New `mobile-touch.cy.ts` covering `touchend`, outside-`touchstart`, scroll repositioning, and factory opt-out.
- **M10** README rewritten with migration cookbook from `@tiptap/extension-link`, full options/commands/keyboard tables, accessibility statement, and per-spec coverage table.
- (only if Task 3 raised the coverage floor) `bunfig.toml` line-coverage threshold raised to `<new-value>`.
```

- [ ] **Step 3: Optional — bump the entry date if releasing on a different day**

If the actual publish day differs from `2026-04-20` (the existing date), update the header in place:

```diff
-## [2.0.0] — 2026-04-20
+## [2.0.0] — <YYYY-MM-DD>
```

Do **not** create a second header for the new date.

- [ ] **Step 4: Verify the package builds clean with the finalized CHANGELOG**

```bash
bun run --filter @docs.plus/extension-hyperlink build
cd packages/extension-hyperlink && bun run scripts/prepack.ts
```

`prepack.ts` is the safe smoke-test: it runs the LICENSE sync + verifies the build artifacts the `exports` map points at, without requiring the `bun publish` user-agent gate (that runs at Task 7).

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/CHANGELOG.md
git commit -m "docs(extension-hyperlink): finalize [2.0.0] CHANGELOG with PR 3 items

Adds the T1 / T5 / M10 entries to the existing [2.0.0] section.
package.json version was already 2.0.0 on main; no version bump.

See CHANGELOG.md for the full release notes. Highlights:

- Single URL safety policy (B1).
- Tiptap-Link parity options (M1, M2, M3).
- Pure setHyperlink + dedicated open*Popover commands (M4) ← BREAKING.
- WCAG 2.1 AA popovers (B2).
- Popover lifecycle owned by the mark (B3, S1).
- New CI workflow with publint gate (B4).
- README rewritten with migration cookbook from @tiptap/extension-link (M10)."
```

---

## Task 6: Final quality gate + manual smoke test

**Files:** none

- [ ] **Step 1: Run the entire CI gate locally**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
bun install
bun run --filter @docs.plus/extension-hyperlink lint
bun run --filter @docs.plus/extension-hyperlink test:unit:coverage
bun run --filter @docs.plus/extension-hyperlink build
cd packages/extension-hyperlink && bunx publint --strict .
cd ../.. && bun run --filter @docs.plus/extension-hyperlink test:e2e
bun run --filter @docs.plus/webapp typecheck
bun run --filter @docs.plus/webapp build
```

Expected: every command exits 0.

- [ ] **Step 2: Smoke-test the playground**

```bash
cd packages/extension-hyperlink
bun run playground
```

Manually verify in a real browser:

1. Type `https://example.com` — autolinks.
2. Type `select me`, select all, `Cmd+K`, paste `https://other.com`, Enter — link applied.
3. Click the link — preview popover appears with Copy, Edit, Remove.
4. Click Copy — clipboard contains the URL.
5. Click Edit — edit popover; change text, Apply.
6. Press `Cmd+Click` on a link — opens in new tab; preview popover does **not** appear.
7. Tab through the create popover — focus order is sane.
8. Press `Esc` in the popover — focus returns to the editor.

If any of these fail, fix in a sub-commit before declaring done.

- [ ] **Step 3: Smoke-test the webapp**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
bun run --filter @docs.plus/webapp dev
```

Verify the four migrated call sites work:

1. Desktop toolbar link button → opens create popover.
2. Mobile toolbar link button → opens create popover.
3. Mobile bubble menu link button → opens create popover.
4. Chatroom message composer link button → opens create popover.

- [ ] **Step 4: Push and finalize the PR**

```bash
git push origin feat/extension-hyperlink-2.0
```

Update the PR description with the final 2.0 release summary. Wait for CI green.

---

## Task 7: Post-merge — publish 2.0.0

**Files:** none (release ceremony)

- [ ] **Step 1: Merge `feat/extension-hyperlink-2.0` into `main`**

(Per the team's merge convention — squash, merge commit, or rebase. Spec assumes a stacked-PR or single-PR strategy decided up-front.)

- [ ] **Step 2: Tag the release on `main`**

```bash
cd /Users/macbook/workspace/docsy
git checkout main
git pull origin main
git tag -a @docs.plus/extension-hyperlink@2.0.0 -m "extension-hyperlink 2.0.0"
git push origin @docs.plus/extension-hyperlink@2.0.0
```

- [ ] **Step 3: Publish to npm via `bun publish`**

The package's `peerDependencies` use the `catalog:` protocol — only `bun publish` (and `pnpm publish`) resolve those at pack time. `npm publish` would ship a literal `"catalog:"` string and break every consumer install. `scripts/preflight.ts` enforces this at the `prepublishOnly` hook and will hard-fail any non-Bun publisher.

```bash
cd packages/extension-hyperlink
bun pm pack --dry-run        # inspect the tarball contents
bun publish --access public  # the real thing
```

`prepublishOnly` runs `scripts/preflight.ts` which (1) asserts `bun publish` is the publisher, (2) verifies the dist artifacts the `exports` map points at exist, (3) does a defense-in-depth grep for `"catalog:"` leakage in the bundle, and (4) is augmented in PR 1 Task 14 with `bunx publint --strict .` so any packaging issue blocks the publish.

- [ ] **Step 4: Verify the published package**

```bash
mkdir /tmp/verify-extension-hyperlink && cd /tmp/verify-extension-hyperlink
bun init -y
bun add @docs.plus/extension-hyperlink@2.0.0 @floating-ui/dom linkifyjs @tiptap/core @tiptap/pm
bun -e "import { Hyperlink } from '@docs.plus/extension-hyperlink'; console.log(Object.keys(Hyperlink.prototype ?? Hyperlink))"
```

Expected: prints something Tiptap-shaped without throwing.

- [ ] **Step 5: Remove the worktree**

```bash
cd /Users/macbook/workspace/docsy
git worktree remove ../docsy-extension-hyperlink-2.0
git branch -d feat/extension-hyperlink-2.0
```

---

## Self-review checklist

- [ ] All 9 review items in scope (B1–B5, M1–M11 except M12 deferred, T1–T9, S1) are addressed across PRs 1+2+3.
- [ ] CHANGELOG `[2.0.0]` section calls out every breaking change in plain language.
- [ ] README has a migration row for every renamed command/option.
- [ ] `bun run test` passes locally on every PR commit.
- [ ] CI is green on the merged branch.
- [ ] `bun pm pack --dry-run` shows a tarball that contains exactly: `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`.
- [ ] No code comment narrates _what_ — only _why_.
- [ ] No `TODO(...)` markers from the 2.0 development cycle remain in the source tree.
- [ ] Worktree removed after merge.
