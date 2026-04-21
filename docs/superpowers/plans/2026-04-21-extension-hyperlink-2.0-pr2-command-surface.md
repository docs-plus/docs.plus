# Extension-Hyperlink 2.0 — PR 2: Command surface, markdown, accessibility

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the public command shape match the official `@tiptap/extension-link`, add markdown defaults, fix popover accessibility (WCAG 2.1 AA), and clean up popover lifecycle so nothing outlives the editor. This PR contains the only intentional breaking change of the 2.0 release: `setHyperlink` becomes a pure mark command with no UI side effect.

**Architecture:** Three commands replace the old overloaded `setHyperlink`:

- `setHyperlink({ href })` — pure mark write (no popover).
- `openCreateHyperlinkPopover(attrs?)` — opens the create popover.
- `openEditHyperlinkPopover(attrs?)` — opens the edit popover.

The popover layer gains `onHide` callbacks that restore focus to the editor. Inputs gain proper `<label>`s and validation gains ARIA. `cypress-axe` runs on every popover state to gate WCAG 2.1 AA.

**Spec:** `/Users/macbook/workspace/docsy/docs/superpowers/specs/2026-04-21-extension-hyperlink-2.0-design.md`

**Branch:** continue on `feat/extension-hyperlink-2.0` (same worktree as PR 1).

**Depends on:** PR 1 merged into `feat/extension-hyperlink-2.0`. If PR 1 isn't merged yet, rebase before each task.

---

## Task 0: Sync worktree with PR 1's main

**Files:** none

- [ ] **Step 1: Pull latest main into the worktree branch**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
git fetch origin
git rebase origin/main
bun install --frozen-lockfile
```

- [ ] **Step 2: Verify PR 1 quality gates still pass**

```bash
bun run --filter @docs.plus/extension-hyperlink lint
bun run --filter @docs.plus/extension-hyperlink test:unit:coverage
bun run --filter @docs.plus/extension-hyperlink coverage:check
bun run --filter @docs.plus/extension-hyperlink build
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: all green. If anything fails, fix before starting PR 2.

---

## Task 1: Add `toggleHyperlink` command (M2)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`

- [ ] **Step 1: Extend the `Commands` declaration**

In `packages/extension-hyperlink/src/hyperlink.ts` find the `declare module '@tiptap/core'` block (currently around lines 61-76). Add `toggleHyperlink`:

```ts
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hyperlink: {
      editHyperlinkText: (text: string) => ReturnType
      editHyperlinkHref: (href: string) => ReturnType
      editHyperlink: (attributes?: {
        newText?: string
        newURL?: string
        title?: string
        image?: string
      }) => ReturnType
      setHyperlink: (attributes: { href: string; target?: string | null }) => ReturnType
      toggleHyperlink: (attributes: { href: string; target?: string | null }) => ReturnType
      unsetHyperlink: () => ReturnType
      openCreateHyperlinkPopover: (attributes?: Partial<HyperlinkAttributes>) => ReturnType
      openEditHyperlinkPopover: () => ReturnType
    }
  }
}
```

Note: the `setHyperlink` argument is now **required** (no longer optional). The popover-opening responsibility moves to `openCreateHyperlinkPopover`. This is the breaking change.

- [ ] **Step 2: Implement `toggleHyperlink`**

In `addCommands()` (currently lines 167-279), add (right after `unsetHyperlink`, before the closing brace):

```ts
toggleHyperlink:
  (attributes) =>
  ({ chain }) => {
    if (
      attributes?.href &&
      !isSafeHyperlinkHref(attributes.href, policyCtx(this.options))
    ) {
      return false
    }
    if (
      attributes?.href &&
      this.options.validate &&
      !this.options.validate(attributes.href)
    ) {
      return false
    }
    const normalized = attributes?.href
      ? { ...attributes, href: normalizeHref(attributes.href) }
      : attributes
    return chain()
      .toggleMark(this.name, normalized, { extendEmptyMarkRange: true })
      .setMeta('preventAutolink', true)
      .run()
  },
```

- [ ] **Step 3: Build, test**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
```

- [ ] **Step 4: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): add toggleHyperlink command (M2)

Mirrors @tiptap/extension-link's toggleLink. Same precedence
(isSafeHyperlinkHref → validate → normalizeHref → toggleMark).
extendEmptyMarkRange: true so toggling on a single position toggles
the whole mark range, not just the cursor.

Also extends the Commands declaration with the new
openCreateHyperlinkPopover / openEditHyperlinkPopover signatures.
Implementation lands in the next task."
```

---

## Task 2: Refactor `setHyperlink` into 3 commands (M4)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`
- Create: `packages/extension-hyperlink/src/helpers/openCreatePopover.ts`
- Create: `packages/extension-hyperlink/src/helpers/openEditPopover.ts`

This is the load-bearing refactor of PR 2. Move all the popover-opening side effects out of `setHyperlink` into dedicated commands.

- [ ] **Step 1: Extract the create-popover side effect**

Create `packages/extension-hyperlink/src/helpers/openCreatePopover.ts`:

```ts
import type { Editor } from '@tiptap/core'

import type { CreateHyperlinkOptions, HyperlinkAttributes, HyperlinkOptions } from '../hyperlink'
import { createFloatingToolbar } from './floatingToolbar'

const INPUT_FOCUS_DELAY_MS = 100

type Args = {
  editor: Editor
  extensionName: string
  options: HyperlinkOptions
  attributes?: Partial<HyperlinkAttributes>
}

/**
 * Opens the create-hyperlink popover anchored to the current selection.
 * Returns true if the popover was opened (or no factory is configured),
 * never throws — callers shouldn't have to wrap.
 *
 * Side effects: appends a floating toolbar to document.body, focuses
 * the popover input on a microtask so screen readers announce the
 * label. Lifecycle is owned by the toolbar.
 */
export function openCreatePopover(args: Args): boolean {
  const { editor, options, attributes = {}, extensionName } = args
  const factory = options.popovers.createHyperlink
  if (!factory) return true

  const content = factory({
    editor,
    validate: options.validate,
    extensionName,
    attributes
  } satisfies CreateHyperlinkOptions)
  if (!content) return true

  const { from, to } = editor.state.selection
  const previouslyFocused = document.activeElement as HTMLElement | null

  const toolbar = createFloatingToolbar({
    coordinates: {
      getBoundingClientRect: () => {
        try {
          const start = editor.view.coordsAtPos(from)
          const end = editor.view.coordsAtPos(to)
          return {
            x: start.left,
            y: start.top,
            width: end.left - start.left,
            height: end.bottom - start.top
          }
        } catch {
          queueMicrotask(() => toolbar.hide())
          return { x: -9999, y: -9999, width: 0, height: 0 }
        }
      },
      contextElement: editor.view.dom
    },
    content,
    placement: 'bottom',
    showArrow: true,
    onHide: () => {
      // Restore focus per WCAG 2.4.3 / 3.2.1. Prefer the editor over
      // the previously-focused element when the editor was the trigger.
      if (editor.isEditable && !editor.isDestroyed) {
        editor.commands.focus()
      } else if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  })

  toolbar.show()

  const input = content.querySelector('input')
  if (input) setTimeout(() => input.focus(), INPUT_FOCUS_DELAY_MS)
  return true
}
```

- [ ] **Step 2: Extract the edit-popover side effect**

Create `packages/extension-hyperlink/src/helpers/openEditPopover.ts`:

```ts
import type { Editor } from '@tiptap/core'
import { getMarkRange, getMarkType } from '@tiptap/core'

import type { HyperlinkAttributes, HyperlinkOptions, PreviewHyperlinkOptions } from '../hyperlink'
import { createFloatingToolbar, DEFAULT_OFFSET } from './floatingToolbar'

type Args = {
  editor: Editor
  extensionName: string
  options: HyperlinkOptions
}

/**
 * Opens the edit/preview popover for the link mark at the current
 * selection. No-op (returns false) when the cursor is not inside
 * a hyperlink mark.
 */
export function openEditPopover(args: Args): boolean {
  const { editor, options, extensionName } = args
  const factory = options.popovers.previewHyperlink
  if (!factory) return false

  const markType = getMarkType(extensionName, editor.schema)
  const range = getMarkRange(editor.state.selection.$from, markType)
  if (!range) return false

  const node = editor.state.doc.nodeAt(range.from)
  const mark = node?.marks.find((m) => m.type === markType)
  if (!mark) return false

  const attrs = mark.attrs as HyperlinkAttributes
  if (!attrs.href) return false

  // Find the rendered <a> for this mark range — anchor for the toolbar.
  const link = editor.view.nodeDOM(range.from) as HTMLElement | null
  const anchor =
    link instanceof HTMLAnchorElement
      ? link
      : (link?.closest('a[href]') ?? editor.view.dom.querySelector(`a[href="${attrs.href}"]`))
  if (!(anchor instanceof HTMLAnchorElement)) return false

  const rect = anchor.getBoundingClientRect()
  const previouslyFocused = document.activeElement as HTMLElement | null

  const content = factory({
    editor,
    view: editor.view,
    link: anchor,
    nodePos: range.from,
    attrs,
    linkCoords: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    validate: options.validate
  } satisfies PreviewHyperlinkOptions)
  if (!content) return false

  const toolbar = createFloatingToolbar({
    referenceElement: anchor,
    content,
    placement: 'bottom',
    offset: DEFAULT_OFFSET,
    showArrow: true,
    onHide: () => {
      if (editor.isEditable && !editor.isDestroyed) {
        editor.commands.focus()
      } else if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  })

  toolbar.show()
  return true
}
```

- [ ] **Step 3: Rewrite `setHyperlink` to be pure**

In `hyperlink.ts` `addCommands()`, replace the existing `setHyperlink` (currently lines 169-247) with:

```ts
setHyperlink:
  (attributes) =>
  ({ chain }) => {
    if (!attributes?.href) return false
    const normalizedHref = normalizeHref(attributes.href)
    if (!isSafeHyperlinkHref(normalizedHref, policyCtx(this.options))) return false
    if (this.options.validate && !this.options.validate(normalizedHref)) return false
    const normalized = { ...attributes, href: normalizedHref }
    return chain().setMark(this.name, normalized).setMeta('preventAutolink', true).run()
  },
```

`setHyperlink` is now a pure mark write. No popover side effect, no `editor.commands.focus()`, no DOM mutations.

- [ ] **Step 4: Add the new popover-opening commands**

Add to `addCommands()` (after `unsetHyperlink`, before `toggleHyperlink`):

```ts
openCreateHyperlinkPopover:
  (attributes) =>
  ({ editor }) => {
    return openCreatePopover({
      editor,
      extensionName: this.name,
      options: this.options,
      attributes
    })
  },

openEditHyperlinkPopover:
  () =>
  ({ editor }) => {
    return openEditPopover({
      editor,
      extensionName: this.name,
      options: this.options
    })
  },
```

Add the imports at the top of `hyperlink.ts`:

```ts
import { openCreatePopover } from './helpers/openCreatePopover'
import { openEditPopover } from './helpers/openEditPopover'
```

And remove the now-unused `createFloatingToolbar` import (and `INPUT_FOCUS_DELAY_MS` constant) from the top of `hyperlink.ts` — they live in the helpers now.

- [ ] **Step 5: Update the Mod-K shortcut**

In `addKeyboardShortcuts()` (currently lines 281-285):

```ts
addKeyboardShortcuts() {
  return {
    'Mod-k': () => {
      // If selection is inside a hyperlink, open the edit/preview
      // popover; otherwise open the create popover. Mirrors common
      // editor UX (Notion, Slack).
      const isInLink = this.editor.isActive(this.name)
      return isInLink
        ? this.editor.commands.openEditHyperlinkPopover()
        : this.editor.commands.openCreateHyperlinkPopover()
    }
  }
},
```

- [ ] **Step 6: Build, run unit + E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

The Cypress create-popover spec (`create.cy.ts`) likely uses `setHyperlink()` via Mod+K (which now still works because Mod-K is wired to the new command) — should keep passing. If it directly calls `editor.commands.setHyperlink()` with no args, update those tests now.

- [ ] **Step 7: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts \
        packages/extension-hyperlink/src/helpers/openCreatePopover.ts \
        packages/extension-hyperlink/src/helpers/openEditPopover.ts
git commit -m "feat(extension-hyperlink)!: split setHyperlink into pure + popover commands (M4)

BREAKING CHANGE: setHyperlink({ href }) is now a pure mark command
that no longer opens a popover. Two new commands take over the UI:

  - openCreateHyperlinkPopover(attrs?) — opens the create UI.
  - openEditHyperlinkPopover()         — opens the edit/preview UI.

Mod-K now resolves to the right command based on whether the cursor
is inside an existing link (edit) or not (create).

Webapp call sites that did editor.chain().focus().setHyperlink().run()
break and must migrate; that migration lands in the next task.

Rationale: setHyperlink performing a UI side effect violates command
purity, makes programmatic mark application impossible without
opening a popover, and is the single largest deviation from the
official @tiptap/extension-link API. Tiptap-Link parity (M1, M2,
M4 together) is now complete."
```

---

## Task 3: Migrate webapp call sites to the new API

**Files:**

- Modify: `packages/webapp/src/components/pages/document/components/MobileBubbleMenu.tsx`
- Modify: `packages/webapp/src/components/TipTap/toolbar/desktop/EditorToolbar.tsx`
- Modify: `packages/webapp/src/components/chatroom/components/MessageComposer/components/Toolbar/ToolbarButtons/HyperlinkButton.tsx`
- Modify: `packages/webapp/src/components/TipTap/toolbar/mobile/ToolbarMobile.tsx`

- [ ] **Step 1: Search for every webapp call site**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
rg "setHyperlink\(\)" packages/webapp/src
```

Expected: the four files listed above. If any new file appeared, include it.

- [ ] **Step 2: Replace each call**

For each match, change:

```tsx
editor?.chain().focus().setHyperlink().run()
```

to:

```tsx
editor?.chain().focus().openCreateHyperlinkPopover().run()
```

(Keep the `editor?` optional chain or `editor.chain()` based on what each file already uses.)

- [ ] **Step 3: Verify no remaining no-arg calls**

```bash
rg "setHyperlink\(\)" packages/webapp/src
```

Expected: no matches.

- [ ] **Step 4: Type-check the webapp**

```bash
bun run --filter @docs.plus/webapp typecheck
```

If this command name is different in the webapp, use whatever its `tsc --noEmit` script is called. Expected: clean.

- [ ] **Step 5: Smoke-test the webapp build**

```bash
bun run --filter @docs.plus/webapp build
```

Expected: clean. If the webapp has its own E2E tests that touch the link button, run them.

- [ ] **Step 6: Commit**

```bash
git add packages/webapp/src
git commit -m "feat(webapp): migrate to openCreateHyperlinkPopover (M4 follow-up)

setHyperlink no longer opens the popover as a side effect; the four
call sites that relied on that behavior switch to the new
openCreateHyperlinkPopover command, which is the explicit way to
open the create UI in extension-hyperlink 2.0."
```

---

## Task 4: Markdown defaults — `exitable` + `markdownTokenName` (M3)

**Files:**

- Modify: `packages/extension-hyperlink/src/hyperlink.ts`

- [ ] **Step 1: Add the option, default markdown hooks, and `exitable: true`**

In `hyperlink.ts`, extend `HyperlinkOptions` (Task 6 of PR 1 already added the others; add to the same interface):

```ts
export interface HyperlinkOptions {
  // ... existing fields ...

  /**
   * Markdown token name used by the @docs.plus markdown pipeline.
   * Defaults to 'link' so the extension serializes/parses as the
   * standard markdown link. Webapp can override via .extend({ ... }).
   */
  markdownTokenName: string

  /** Markdown parse hook (called by the markdown pipeline). */
  parseMarkdown?: (token: unknown) => Partial<HyperlinkAttributes> | null

  /** Markdown render hook (called by the markdown pipeline). */
  renderMarkdown?: (attrs: HyperlinkAttributes, text: string) => string
}
```

In `addOptions()`:

```ts
markdownTokenName: 'link',
parseMarkdown: undefined,
renderMarkdown: undefined,
```

- [ ] **Step 2: Add `exitable: true` to the mark schema**

In `Mark.create<HyperlinkOptions>({ ... })`, add the field next to `keepOnSplit`:

```ts
keepOnSplit: false,

// True so the user can press → at the end of a hyperlink and exit
// the mark, matching @tiptap/extension-link parity. Without this,
// continuing to type after a link extends the link's text.
exitable: true,
```

If `exitable` is not in the version of `@tiptap/core` listed in the catalog, this is the version-pin reason from PR 1. Verify by reading the type:

```bash
rg "exitable" node_modules/@tiptap/core/src
```

If the field is not recognized, leave it out and document in the CHANGELOG; otherwise include.

- [ ] **Step 3: Build, run unit + E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add packages/extension-hyperlink/src/hyperlink.ts
git commit -m "feat(extension-hyperlink): markdown defaults + exitable mark (M3)

Adds three options for markdown-pipeline parity with
@tiptap/extension-link:

  - markdownTokenName (default 'link') — token name used by the
    @docs.plus markdown serializer/parser.
  - parseMarkdown / renderMarkdown — optional hooks consumed by the
    markdown pipeline. Webapp can override via .extend({ ... }) and
    its override takes precedence per Tiptap option resolution.

Sets exitable: true on the mark so → at the end of a link exits
the mark instead of extending it."
```

---

## Task 5: Lifecycle teardown (B3)

**Files:**

- Modify: `packages/extension-hyperlink/src/plugins/clickHandler.ts`
- Modify: `packages/extension-hyperlink/src/hyperlink.ts`
- Modify: `packages/extension-hyperlink/src/helpers/floatingToolbar.ts`

- [ ] **Step 1: Stop clickHandler from owning the toolbar lifecycle**

`clickHandler.ts` currently owns the popover that opens when clicking an existing link. Move that responsibility into `openEditPopover` (the helper from Task 2) so the click handler just delegates.

In `packages/extension-hyperlink/src/plugins/clickHandler.ts`, replace `showPopover` (lines 52-124) with a thin delegation to the new `openEditHyperlinkPopover` command. The full file becomes:

```ts
import { Editor } from '@tiptap/core'
import { MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

import { isSafeHyperlinkHref, type IsSafeHyperlinkHrefContext } from '../utils/validateURL'

type ClickHandlerOptions = {
  type: MarkType
  editor: Editor
  validate?: (url: string) => boolean
  policyCtx: IsSafeHyperlinkHrefContext
  hasPreviewPopover: boolean
}

function findLinkFromEvent(event: MouseEvent | TouchEvent, root: HTMLElement) {
  const target = event.target as HTMLElement | null
  if (!target) return null
  const link = target.closest<HTMLAnchorElement>('a')
  if (!link || !root.contains(link)) return null
  return link
}

function handleActivation(
  view: EditorView,
  link: HTMLAnchorElement,
  options: ClickHandlerOptions,
  clickPos: number | undefined
): boolean {
  const href = link.getAttribute('href')
  if (!href || !isSafeHyperlinkHref(href, options.policyCtx)) return true

  if (!options.hasPreviewPopover) {
    if (!view.editable) {
      window.open(href, link.target || '_blank', 'noopener,noreferrer')
    }
    return !view.editable
  }

  if (clickPos !== undefined) {
    options.editor
      .chain()
      .focus(clickPos === 0 ? 'start' : clickPos)
      .run()
  }
  return options.editor.commands.openEditHyperlinkPopover()
}

export default function clickHandlerPlugin(options: ClickHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkClickHandler'),

    view(editorView) {
      const preventMouseDown = (event: MouseEvent) => {
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

      editorView.dom.addEventListener('mousedown', preventMouseDown, true)
      editorView.dom.addEventListener('click', preventClick, true)

      return {
        destroy() {
          editorView.dom.removeEventListener('mousedown', preventMouseDown, true)
          editorView.dom.removeEventListener('click', preventClick, true)
        }
      }
    },

    props: {
      handleDOMEvents: {
        touchend: (view, event) => {
          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false
          event.preventDefault()
          const { clientX, clientY } = event.changedTouches[0]
          const pos = view.posAtCoords({ left: clientX, top: clientY })
          return handleActivation(view, link, options, pos?.pos)
        },
        click: (view, event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey) return false
          const link = findLinkFromEvent(event, view.dom)
          if (!link) return false
          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
          return handleActivation(view, link, options, pos?.pos)
        }
      }
    }
  })
}
```

The two `TODO(PR2-Task5)` ESLint suppressions from PR 1 Task 3 are gone — the click handler no longer imports from `helpers/floatingToolbar`. Delete them along with this rewrite.

- [ ] **Step 2: Update the call site in `hyperlink.ts`**

`addProseMirrorPlugins()` block for clickHandler:

```ts
if (this.options.openOnClick) {
  plugins.push(
    clickHandlerPlugin({
      type: this.type,
      editor: this.editor,
      validate: this.options.validate,
      policyCtx: policyCtx(this.options),
      hasPreviewPopover: !!this.options.popovers.previewHyperlink
    })
  )
}
```

- [ ] **Step 3: Add `onDestroy` to the Hyperlink mark for popover teardown**

In `Mark.create<HyperlinkOptions>({ ... })`, add (next to `onCreate`):

```ts
onDestroy() {
  // Hide any popover that's still open when the editor is torn
  // down. Without this, navigating away from an editor view that
  // had an active popover leaves the floating toolbar (and its
  // outside-click listeners) attached to document.body.
  hideCurrentToolbar()
},
```

Add the import at the top:

```ts
import { hideCurrentToolbar } from './helpers/floatingToolbar'
```

- [ ] **Step 4: Fix `setContent` to remove old keydown listeners**

In `packages/extension-hyperlink/src/helpers/floatingToolbar.ts`, the `setupKeyboardNav` function (lines 90-106) attaches a `keydown` listener to every focusable element but never removes them. When `setContent` is called multiple times (live edit during open) listeners accumulate.

Refactor `setupKeyboardNav` to return its cleanup, and refactor `setContent` to track and run the cleanup:

```ts
function setupKeyboardNav(container: HTMLElement): () => void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) return () => {}

  const handlers: Array<{ el: HTMLElement; fn: (e: KeyboardEvent) => void }> = []

  focusable.forEach((el, i) => {
    const fn = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const next = e.shiftKey
        ? (i - 1 + focusable.length) % focusable.length
        : (i + 1) % focusable.length
      focusable[next].focus()
    }
    el.addEventListener('keydown', fn)
    handlers.push({ el, fn })
  })

  return () => handlers.forEach(({ el, fn }) => el.removeEventListener('keydown', fn))
}
```

Then in the `createFloatingToolbar` body (around line 151), introduce a `keyboardNavCleanup` variable and wire it through:

```ts
let keyboardNavCleanup: (() => void) | null = null

const setContent = (el: HTMLElement): void => {
  keyboardNavCleanup?.()
  contentContainer.innerHTML = ''
  contentContainer.appendChild(el)
  keyboardNavCleanup = setupKeyboardNav(toolbar)
}

setContent(content)
```

And in `hide()` (line 200), call `keyboardNavCleanup?.()` before the existing cleanups loop.

- [ ] **Step 5: Build, run unit + E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun test src
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: green. The click handler refactor is the largest behavioral change here — pay attention to `create.cy.ts` (links opened via click should still show the preview popover).

- [ ] **Step 6: Commit**

```bash
git add packages/extension-hyperlink/src/plugins/clickHandler.ts \
        packages/extension-hyperlink/src/hyperlink.ts \
        packages/extension-hyperlink/src/helpers/floatingToolbar.ts
git commit -m "refactor(extension-hyperlink): popover lifecycle owned by mark, not click handler (B3)

Three lifecycle fixes:

1. clickHandler.ts no longer creates floating toolbars directly. It
   delegates to the openEditHyperlinkPopover command (added in Task 2)
   which lives in helpers/openEditPopover.ts. The PR 1 ESLint
   suppressions in clickHandler.ts are now gone.

2. Hyperlink.onDestroy() calls hideCurrentToolbar() so popovers and
   their outside-click listeners can't outlive the editor.

3. floatingToolbar.setContent() now removes the previous keyboard-nav
   listeners before adding new ones (prevents listener accumulation
   across content swaps)."
```

---

## Task 6: Accessibility — popover ARIA + labels (B2)

**Files:**

- Modify: `packages/extension-hyperlink/src/popovers/createHyperlinkPopover.ts`
- Modify: `packages/extension-hyperlink/src/popovers/editHyperlinkPopover.ts`
- Modify: `packages/extension-hyperlink/src/popovers/previewHyperlinkPopover.ts`

The accessibility changes are repetitive — same patterns applied to three files. Group the substantive ARIA shape into a single helper.

- [ ] **Step 1: Create an a11y helpers module**

Create `packages/extension-hyperlink/src/utils/a11y.ts`:

```ts
import { createHTMLElement } from './createHTMLElement'

let _idCounter = 0
const nextId = () => `hyperlink-a11y-${++_idCounter}`

/**
 * Build an accessible <input> + <label> pair. Returns the input and
 * label so callers can place them in their existing DOM structure.
 *
 * The label is visually hidden by default (sr-only) — pass
 * `visibleLabel: true` to render normally.
 *
 * The input gets an id, aria-describedby pointing to an error
 * element (id returned in `errorId`), and aria-invalid wired so the
 * caller only needs to toggle `setError(true|false)`.
 */
export function makeLabeledInput(args: {
  labelText: string
  inputAttrs: Record<string, unknown>
  errorText: string
  visibleLabel?: boolean
}): {
  label: HTMLLabelElement
  input: HTMLInputElement
  error: HTMLElement
  setError: (on: boolean) => void
  ids: { input: string; error: string }
} {
  const inputId = nextId()
  const errorId = nextId()

  const input = createHTMLElement('input', {
    ...args.inputAttrs,
    id: inputId,
    'aria-describedby': errorId,
    'aria-invalid': 'false'
  }) as HTMLInputElement

  const label = createHTMLElement('label', {
    htmlFor: inputId,
    textContent: args.labelText,
    className: args.visibleLabel ? '' : 'sr-only'
  }) as HTMLLabelElement

  const error = createHTMLElement('div', {
    id: errorId,
    className: 'error-message',
    role: 'alert',
    'aria-live': 'polite',
    textContent: args.errorText
  })

  const setError = (on: boolean): void => {
    input.setAttribute('aria-invalid', on ? 'true' : 'false')
    error.classList.toggle('show', on)
  }

  return { label, input, error, setError, ids: { input: inputId, error: errorId } }
}

/** Add an aria-label to an icon-only button. Idempotent. */
export function labelIconButton(button: HTMLButtonElement, label: string): void {
  if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', label)
}
```

Add to `packages/extension-hyperlink/src/utils/index.ts`:

```ts
export { makeLabeledInput, labelIconButton } from './a11y'
```

If the existing CSS doesn't have `.sr-only`, add it to `packages/extension-hyperlink/src/styles.css` (or wherever popover styles live):

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Refactor `createHyperlinkPopover.ts` to use the helper**

Replace `createHyperlinkElements` and `setupEventListeners` with the labeled-input pattern. The full new file:

```ts
import { hideCurrentToolbar } from '../helpers/floatingToolbar'
import type { CreateHyperlinkOptions } from '../hyperlink'
import { createHTMLElement, makeLabeledInput, normalizeHref, validateURL } from '../utils'
import { Link } from '../utils/icons'

const buildElements = () => {
  const root = createHTMLElement('div', {
    className: 'hyperlink-create-popover',
    role: 'dialog',
    'aria-label': 'Create hyperlink'
  })
  const form = createHTMLElement('form', {})
  const inputsWrapper = createHTMLElement('div', { className: 'inputs-wrapper' })
  const buttonsWrapper = createHTMLElement('div', { className: 'buttons-wrapper' })

  const { label, input, error, setError } = makeLabeledInput({
    labelText: 'URL',
    errorText: 'Please enter a valid URL',
    inputAttrs: {
      type: 'text',
      inputMode: 'url',
      name: 'hyperlink-url',
      placeholder: 'https://example.com',
      autocomplete: 'new-password',
      spellcheck: 'false'
    }
  })

  const button = createHTMLElement('button', {
    type: 'submit',
    textContent: 'Apply',
    disabled: true
  }) as HTMLButtonElement

  const searchIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Link({ size: 24 }),
    'aria-hidden': 'true'
  })

  inputsWrapper.append(searchIcon, label, input, error)
  buttonsWrapper.append(button)
  form.append(inputsWrapper, buttonsWrapper)
  root.append(form)

  return { root, form, input, button, inputsWrapper, setError }
}

export default function createHyperlinkPopover(
  options: CreateHyperlinkOptions
): HTMLElement | null {
  const els = buildElements()
  if (!els) return null
  const { root, form, input, button, inputsWrapper, setError } = els

  const updateButtonState = () => {
    const hasValue = input.value.trim().length > 0
    button.disabled = !hasValue
    if (hasValue) setError(false)
  }

  input.addEventListener('input', updateButtonState)
  input.addEventListener('paste', () => setTimeout(updateButtonState, 0))
  inputsWrapper.addEventListener('click', () => input.focus())

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      hideCurrentToolbar()
    }
  })

  form.addEventListener('submit', (event: Event) => {
    event.preventDefault()
    if (button.disabled) return

    const url = input.value.trim()
    if (!validateURL(url, { customValidator: options.validate })) {
      setError(true)
      input.focus()
      return
    }

    const href = normalizeHref(url)
    hideCurrentToolbar()
    options.editor
      .chain()
      .setMark(options.extensionName, { href })
      .setMeta('preventAutolink', true)
      .run()
  })

  return root
}
```

The `editor.commands.focus()` after Escape is removed because `floatingToolbar.onHide` now restores focus (set up in Task 2's `openCreatePopover`).

- [ ] **Step 3: Apply the same pattern to `editHyperlinkPopover.ts`**

Read the current file:

```bash
cat packages/extension-hyperlink/src/popovers/editHyperlinkPopover.ts
```

Apply the analogous changes:

1. Wrap root in `<div role="dialog" aria-label="Edit hyperlink">`.
2. Replace each input with the `makeLabeledInput` pattern (URL field + Text field).
3. Add `aria-label` to icon buttons (Save, Cancel) via `labelIconButton`.
4. Wire `setError` for validation feedback.
5. Remove explicit `editor.commands.focus()` after Escape — `onHide` handles it.

Because the structure is similar to `createHyperlinkPopover`, factor the common `<dialog>` wrapper into a tiny helper if and only if doing so doesn't add a new file (e.g. one inline function in a shared file). Otherwise duplicate to keep the per-file structure obvious.

- [ ] **Step 4: Apply ARIA to `previewHyperlinkPopover.ts`**

Read the current file. Add to it:

1. Root `role="dialog" aria-label="Hyperlink preview"`.
2. `aria-label` on each icon-only action button (Copy, Edit, Remove).
3. Decorative icons get `aria-hidden="true"`.
4. The displayed URL gets `dir="ltr"` so RTL contexts don't reverse it. (Truncation per N4 stays out of scope.)

Example pattern for a Copy button:

```ts
labelIconButton(copyButton, 'Copy link')
copyIcon.setAttribute('aria-hidden', 'true')
```

- [ ] **Step 5: Build, run E2E**

```bash
bun run --filter @docs.plus/extension-hyperlink build
bun run --filter @docs.plus/extension-hyperlink test:e2e
```

Expected: existing E2E specs still pass — they don't yet check ARIA, but they do check that buttons are clickable and inputs accept text. If a spec selected an input by `[type="text"]` or similar, it might still pass; if it selected by `[name="hyperlink-url"]`, that's preserved.

- [ ] **Step 6: Commit**

```bash
git add packages/extension-hyperlink/src/utils/a11y.ts \
        packages/extension-hyperlink/src/utils/index.ts \
        packages/extension-hyperlink/src/popovers/ \
        packages/extension-hyperlink/src/styles.css
git commit -m "feat(extension-hyperlink): WCAG 2.1 AA popover accessibility (B2)

All three popovers (create, edit, preview) gain:
- role=\"dialog\" + aria-label on the root.
- <label htmlFor> + visually-hidden text for every form input.
- aria-invalid + aria-describedby + role=\"alert\" + aria-live for
  validation errors.
- aria-label on icon-only buttons (Copy, Edit, Remove, Apply, Cancel).
- aria-hidden=\"true\" on decorative icons.

Focus restoration after dismiss is handled by the floating toolbar's
onHide callback added in Task 2 — popover code no longer calls
editor.commands.focus() directly.

New helper: src/utils/a11y.ts (makeLabeledInput + labelIconButton)
keeps the wiring DRY across popovers."
```

---

## Task 7: Wire `cypress-axe` and gate WCAG 2.1 AA (B2)

**Files:**

- Modify: `packages/extension-hyperlink/cypress/support/e2e.ts`
- Create: `packages/extension-hyperlink/cypress/e2e/a11y.cy.ts`
- Create: `packages/extension-hyperlink/cypress/support/a11y.ts`

- [ ] **Step 1: Wire axe into the support file**

Edit `packages/extension-hyperlink/cypress/support/e2e.ts`:

```ts
import 'cypress-axe'
import './keyboard'
import './a11y'
```

- [ ] **Step 2: Create the a11y helpers**

Create `packages/extension-hyperlink/cypress/support/a11y.ts`:

```ts
const AXE_RULES = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
  }
}

declare global {
  namespace Cypress {
    interface Chainable {
      injectAndCheckA11y(context?: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('injectAndCheckA11y', (context?: string) => {
  cy.injectAxe()
  cy.checkA11y(context, AXE_RULES, (violations) => {
    violations.forEach((v) => {
      console.warn(`[axe] ${v.id}: ${v.help} (${v.helpUrl})`)
      v.nodes.forEach((n) => console.warn('  ', n.target, n.failureSummary))
    })
  })
})

export {}
```

- [ ] **Step 3: Create the a11y spec**

Create `packages/extension-hyperlink/cypress/e2e/a11y.cy.ts`:

```ts
import { pressMod } from '../support/keyboard'

describe('extension-hyperlink WCAG 2.1 AA', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173')
    cy.get('#editor').click()
  })

  it('idle editor passes axe', () => {
    cy.injectAndCheckA11y('#editor')
  })

  it('create popover passes axe', () => {
    cy.get('#editor').type('select me{selectall}')
    pressMod('K')
    cy.get('.hyperlink-create-popover').should('be.visible')
    cy.injectAndCheckA11y('.hyperlink-create-popover')
  })

  it('create popover error state passes axe', () => {
    cy.get('#editor').type('select me{selectall}')
    pressMod('K')
    cy.get('.hyperlink-create-popover input').type('not a url{enter}')
    cy.get('.hyperlink-create-popover .error-message.show').should('be.visible')
    cy.injectAndCheckA11y('.hyperlink-create-popover')
  })

  it('preview popover passes axe', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover').should('be.visible')
    cy.injectAndCheckA11y('.hyperlink-preview-popover')
  })

  it('edit popover passes axe', () => {
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover [aria-label="Edit link"]').click()
    cy.get('.hyperlink-edit-popover').should('be.visible')
    cy.injectAndCheckA11y('.hyperlink-edit-popover')
  })

  it('focus returns to editor after Escape', () => {
    cy.get('#editor').type('select me{selectall}')
    pressMod('K')
    cy.get('.hyperlink-create-popover input').type('{esc}')
    cy.focused().should('have.attr', 'contenteditable', 'true')
  })
})
```

Adjust the popover selectors and the "Edit link" aria-label to whatever the popovers actually expose after Task 6.

- [ ] **Step 4: Run axe and address violations**

```bash
cd packages/extension-hyperlink
bun run test:e2e -- --spec cypress/e2e/a11y.cy.ts
```

Expected: green. If axe reports issues, fix them in the relevant popover (most common: missing alt text on icons not marked `aria-hidden`, color-contrast on the error message). Iterate.

- [ ] **Step 5: Commit**

```bash
git add packages/extension-hyperlink/cypress
git commit -m "test(extension-hyperlink): WCAG 2.1 AA gate via cypress-axe (B2)

a11y.cy.ts runs axe-core (wcag2a/aa + wcag21a/aa rule sets) against:
  - idle editor
  - create popover (initial + error state)
  - preview popover
  - edit popover

Plus an explicit assertion that focus returns to the editor after
Escape — verifying the onHide focus restoration set up in Task 2.

A failing axe rule fails the spec, blocking merge until fixed.
The CI workflow added in PR 1 already runs cypress so this is
automatic — no workflow change."
```

---

## Task 8: Test gap — IME / composition (T2)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/ime.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
import { pressMod } from '../support/keyboard'

describe('autolink + IME composition (T2)', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173')
    cy.get('#editor').click()
  })

  it('does not autolink mid-composition', () => {
    cy.get('#editor').then(($el) => {
      const el = $el[0]
      el.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'h' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'ht' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'https://example.com' }))
    })
    cy.get('#editor a').should('not.exist')
  })

  it('autolinks after compositionend + space', () => {
    cy.get('#editor').then(($el) => {
      const el = $el[0]
      el.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'https://example.com' }))
      el.dispatchEvent(new CompositionEvent('compositionend', { data: 'https://example.com' }))
    })
    cy.get('#editor').type(' ')
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
  })

  it('handles Japanese IME-style input without spurious autolink', () => {
    // Simulate hiragana → kanji conversion, no link expected.
    cy.get('#editor').then(($el) => {
      const el = $el[0]
      el.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }))
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'こんにちは' }))
      el.dispatchEvent(new CompositionEvent('compositionend', { data: 'こんにちは' }))
    })
    cy.get('#editor').type(' ')
    cy.get('#editor a').should('not.exist')
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
bun run test:e2e -- --spec cypress/e2e/ime.cy.ts
git add packages/extension-hyperlink/cypress/e2e/ime.cy.ts
git commit -m "test(extension-hyperlink): IME composition autolink behavior (T2)"
```

If the spec fails because the existing autolink plugin doesn't track `compositionstart` / `compositionend` correctly, the fix lives in `autolink.ts` — bail to a sub-task to add a `view.composing` guard before `appendTransaction` runs. Document any such fix in a separate commit referencing T2.

---

## Task 9: Test gap — multi-link selections (T3)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/multi-link.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
describe('selections spanning multiple links (T3)', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173')
    cy.get('#editor').click()
  })

  it('setHyperlink across two adjacent links replaces both', () => {
    cy.get('#editor').type('https://a.com https://b.com ')
    cy.get('#editor a').should('have.length', 2)

    cy.get('#editor').type('{selectall}')
    cy.window().then((win) => {
      ;(win as any).editor.chain().focus().setHyperlink({ href: 'https://merged.com' }).run()
    })
    cy.get('#editor a').should('have.length', 1)
    cy.get('#editor a').should('have.attr', 'href', 'https://merged.com')
  })

  it('unsetHyperlink across two adjacent links removes both', () => {
    cy.get('#editor').type('https://a.com https://b.com ')
    cy.get('#editor').type('{selectall}')
    cy.window().then((win) => {
      ;(win as any).editor.chain().focus().unsetHyperlink().run()
    })
    cy.get('#editor a').should('not.exist')
  })

  it('toggleHyperlink on selection containing one link removes it', () => {
    cy.get('#editor').type('plain https://a.com plain ')
    cy.get('#editor').type('{selectall}')
    cy.window().then((win) => {
      ;(win as any).editor.chain().focus().toggleHyperlink({ href: 'https://a.com' }).run()
    })
    cy.get('#editor a').should('not.exist')
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
bun run test:e2e -- --spec cypress/e2e/multi-link.cy.ts
git add packages/extension-hyperlink/cypress/e2e/multi-link.cy.ts
git commit -m "test(extension-hyperlink): multi-link selection behavior (T3)"
```

---

## Task 10: Test gap — rich-paste with multiple links (T4)

**Files:**

- Create: `packages/extension-hyperlink/cypress/e2e/rich-paste.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
describe('rich-paste with multiple links (T4)', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173')
    cy.get('#editor').click()
  })

  function pasteHtml(html: string) {
    cy.window().then((win) => {
      const dt = new DataTransfer()
      dt.setData('text/html', html)
      dt.setData('text/plain', html.replace(/<[^>]+>/g, ''))
      ;(win as any).editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
    })
  }

  it('preserves multiple <a href> from pasted HTML', () => {
    pasteHtml('<p>See <a href="https://a.com">A</a> and <a href="https://b.com">B</a></p>')
    cy.get('#editor a').should('have.length', 2)
    cy.get('#editor a').eq(0).should('have.attr', 'href', 'https://a.com')
    cy.get('#editor a').eq(1).should('have.attr', 'href', 'https://b.com')
  })

  it('strips dangerous href but keeps safe sibling', () => {
    pasteHtml('<p><a href="javascript:alert(1)">X</a> <a href="https://safe.com">S</a></p>')
    cy.get('#editor a').should('have.length', 1)
    cy.get('#editor a').should('have.attr', 'href', 'https://safe.com')
  })

  it('linkOnPaste with partial selection only links pasted content', () => {
    cy.get('#editor').type('hello world{selectall}')
    cy.window().then((win) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'https://example.com')
      ;(win as any).editor.view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }))
    })
    cy.get('#editor a').should('have.length', 1)
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
    cy.get('#editor a').should('have.text', 'hello world')
  })
})
```

- [ ] **Step 2: Run and commit**

```bash
bun run test:e2e -- --spec cypress/e2e/rich-paste.cy.ts
git add packages/extension-hyperlink/cypress/e2e/rich-paste.cy.ts
git commit -m "test(extension-hyperlink): rich-paste with multi-link HTML (T4)"
```

---

## Task 11: Preview Copy assertion + edit-popover partial coverage (T6, T7)

**Files:**

- Modify: `packages/extension-hyperlink/cypress/e2e/preview-edit.cy.ts` (or whatever spec exercises the preview)
- Create: `packages/extension-hyperlink/cypress/e2e/edit-popover-partial.cy.ts`

- [ ] **Step 1: Add the Copy assertion to the preview spec**

Read `packages/extension-hyperlink/cypress/e2e/preview-edit.cy.ts`. Find the test that clicks the Copy button and add a clipboard assertion using `cy.window().its('navigator.clipboard.readText')` after a stub:

```ts
it('preview Copy writes the href to the clipboard', () => {
  cy.window().then((win) => {
    cy.stub(win.navigator.clipboard, 'writeText').as('clipboardWrite').resolves()
  })
  cy.get('#editor').type('https://example.com ')
  cy.get('#editor a').first().click()
  cy.get('.hyperlink-preview-popover [aria-label="Copy link"]').click()
  cy.get('@clipboardWrite').should('have.been.calledWith', 'https://example.com')
})
```

- [ ] **Step 2: Create the edit-popover-partial spec**

```ts
import { pressMod } from '../support/keyboard'

describe('edit popover partial-update behavior (T7)', () => {
  beforeEach(() => {
    cy.visit('http://127.0.0.1:5173')
    cy.get('#editor').click()
    cy.get('#editor').type('https://example.com ')
    cy.get('#editor a').first().click()
    cy.get('.hyperlink-preview-popover [aria-label="Edit link"]').click()
    cy.get('.hyperlink-edit-popover').should('be.visible')
  })

  it('apply with only-text change preserves href', () => {
    cy.get('.hyperlink-edit-popover input[name="hyperlink-text"]').clear().type('renamed')
    cy.get('.hyperlink-edit-popover button[type="submit"]').click()
    cy.get('#editor a')
      .should('have.attr', 'href', 'https://example.com')
      .and('have.text', 'renamed')
  })

  it('apply with only-URL change preserves text', () => {
    cy.get('.hyperlink-edit-popover input[name="hyperlink-url"]').clear().type('https://other.com')
    cy.get('.hyperlink-edit-popover button[type="submit"]').click()
    cy.get('#editor a')
      .should('have.attr', 'href', 'https://other.com')
      .and('have.text', 'https://example.com')
  })

  it('cancel without apply leaves mark unchanged', () => {
    cy.get('.hyperlink-edit-popover input[name="hyperlink-url"]')
      .clear()
      .type('https://abandoned.com')
    cy.get('.hyperlink-edit-popover input[name="hyperlink-url"]').type('{esc}')
    cy.get('#editor a').should('have.attr', 'href', 'https://example.com')
  })

  it('Tab cycles through visible focusable elements', () => {
    cy.focused().should('have.attr', 'name', 'hyperlink-url')
    cy.realPress('Tab')
    cy.focused().should('have.attr', 'name', 'hyperlink-text')
    cy.realPress('Tab')
    cy.focused().should('have.attr', 'type', 'submit')
  })
})
```

Adjust input `name=` selectors to match what the edit popover renders. If the names differ, use them as-is.

- [ ] **Step 3: Run and commit**

```bash
bun run test:e2e -- --spec "cypress/e2e/{preview-edit,edit-popover-partial}.cy.ts"
git add packages/extension-hyperlink/cypress/e2e
git commit -m "test(extension-hyperlink): preview Copy + edit-popover partial updates (T6, T7)

- Stubs navigator.clipboard.writeText and asserts the preview Copy
  button writes the link's href.
- New spec covers four edit-popover paths: only-text change,
  only-URL change, cancel-without-apply, and Tab cycle order."
```

---

## Task 12: PR 2 wrap-up

**Files:** `packages/extension-hyperlink/CHANGELOG.md`

- [ ] **Step 1: Run the full local quality gate**

```bash
cd /Users/macbook/workspace/docsy-extension-hyperlink-2.0
bun run --filter @docs.plus/extension-hyperlink lint
bun run --filter @docs.plus/extension-hyperlink test:unit:coverage
bun run --filter @docs.plus/extension-hyperlink coverage:check
bun run --filter @docs.plus/extension-hyperlink build
cd packages/extension-hyperlink && bunx publint --strict .
cd ../.. && bun run --filter @docs.plus/extension-hyperlink test:e2e
bun run --filter @docs.plus/webapp typecheck
bun run --filter @docs.plus/webapp build
```

Expected: every command exits 0.

- [ ] **Step 2: Update CHANGELOG**

Append to the `[Unreleased]` section in `packages/extension-hyperlink/CHANGELOG.md`:

```markdown
### BREAKING

- **M4** `setHyperlink({ href })` is now a pure mark command and no longer opens a popover as a side effect. The popover-opening behavior moves to the new commands `openCreateHyperlinkPopover(attrs?)` and `openEditHyperlinkPopover()`. The `Mod-K` keyboard shortcut is wired to whichever is appropriate based on cursor position. The webapp's four call sites that called `setHyperlink()` with no arguments are updated in this release.
- **M4** The `setHyperlink` argument is now required (was optional).

### Added

- **M2** `toggleHyperlink({ href })` command (Tiptap-Link parity).
- **M3** `markdownTokenName` (default `'link'`), `parseMarkdown`, `renderMarkdown` options for markdown-pipeline parity.
- **M3** Mark schema now `exitable: true` — pressing → at the end of a link exits the mark.

### Changed

- **B2** Popovers (create / edit / preview) now meet WCAG 2.1 AA: every input has a label, validation uses `aria-invalid` + `aria-describedby` + `role="alert"`, icon-only buttons have `aria-label`, decorative icons have `aria-hidden`. Focus returns to the editor on every dismiss path.
- **B3** `clickHandler` no longer owns the popover lifecycle; it delegates to `openEditHyperlinkPopover`. Popovers can no longer outlive the editor (`Hyperlink.onDestroy` calls `hideCurrentToolbar`). `floatingToolbar.setContent` cleans up old keyboard listeners before adding new ones.

### Internal

- **T2 / T3 / T4 / T6 / T7** New Cypress specs: IME composition, multi-link selections, rich-paste with multiple links, preview Copy clipboard assertion, edit-popover partial-update paths.
- New helper module `src/utils/a11y.ts` (`makeLabeledInput`, `labelIconButton`).
```

```bash
git add packages/extension-hyperlink/CHANGELOG.md
git commit -m "docs(extension-hyperlink): CHANGELOG for PR 2 (commands, a11y, lifecycle)"
```

- [ ] **Step 3: Push and update the existing PR (or open a new one)**

If PR 1 is still open and unmerged, push to the same branch — the PR auto-updates.

If PR 1 was merged into a `feat/extension-hyperlink-2.0` integration branch and you're keeping a single rolling PR, push and post a comment summarizing PR 2's content. Otherwise open a separate PR if your team prefers stacked PRs:

```bash
git push origin feat/extension-hyperlink-2.0
```

Update the PR description to call out the breaking change loudly:

> **⚠ Breaking change in this update:** `setHyperlink()` no longer opens a popover. Use `openCreateHyperlinkPopover()` instead. The webapp is migrated in this PR.

---

## Self-review checklist

- [ ] Every webapp `setHyperlink()` no-arg call is migrated.
- [ ] No popover code calls `editor.commands.focus()` directly — `onHide` does it.
- [ ] `clickHandler.ts` no longer imports from `helpers/floatingToolbar`. ESLint passes without `TODO(PR2-Task5)` suppressions.
- [ ] `a11y.cy.ts` axe assertions pass on idle / create / create-error / preview / edit popovers.
- [ ] `Hyperlink.onDestroy` is wired and visited by the test suite.
- [ ] CHANGELOG `[Unreleased]` BREAKING section calls out M4 in plain language.
- [ ] No code comment narrates _what_ — only _why_.
