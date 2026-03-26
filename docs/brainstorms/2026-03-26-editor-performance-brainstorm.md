---
date: 2026-03-26
topic: editor-performance
---

# Editor Performance Optimization

## What We're Building

A tiered performance improvement roadmap for the TipTap editor — fixing React re-render waste, plugin efficiency for large documents, and collaboration overhead with many concurrent users. Each tier is independently shippable.

There is noticeable jank in the editor today. The primary suspects are Zustand re-render cascades and awareness churn, not ProseMirror itself.

## Why This Approach

**Approach chosen:** Tiered priority roadmap — quick wins first, deeper optimizations later.

**Approaches considered:**

| Approach                                                  | Verdict                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A. Tiered Priority Roadmap (chosen)                       | Incrementally shippable, biggest jank reduction in Tier 1, no architectural changes |
| B. Profile-First                                          | Slower to start; known antipatterns should be fixed regardless of profiling         |
| C. Structural Redesign (store split, plugin architecture) | Overengineering; most wins achievable within existing architecture                  |

**Why A wins:** The codebase has objectively wrong patterns (selectorless `useStore()`, no `useEditorState`, unthrottled awareness) that are almost certainly the source of visible jank. These are cheap to fix and independently verifiable. Deeper work (Tier 2-3) can be guided by profiling after Tier 1 ships.

## Tier 1 — React Re-render Fixes (Quick Wins)

These are the highest-impact, lowest-effort changes. Fix before anything else.

### 1.1 Fix selectorless `useStore()` calls

**Problem:** `DeleteSectionDialog` and `useTocActions` call `useStore()` with no selector — subscribing to the entire monolithic Zustand store. Any state change (chat, notifications, virtual keyboard, etc.) triggers a re-render.

**Fix:** Replace with leaf selectors (`useStore(s => s.closeDialog)`, `useStore(s => s.settings.editor.instance)`). Also audit the codebase for other selectorless `useStore()` calls (grep for `useStore()` without an arrow function argument) and fix them in the same pass.

### 1.2 Throttle awareness updates in `useProviderAwareness.ts`

**Problem:** Every `awarenessUpdate` event from Yjs calls `setWorkspaceEditorSetting('presentUsers', users)`, replacing the `settings.editor` object reference. With N users, awareness fires frequently — triggering re-renders for any component selecting from `settings.editor.*`.

**Fix:** Throttle the `awarenessUpdate` handler (e.g., 500ms). Presence indicators don't need real-time precision.

### 1.3 Narrow `metadata` selector in `useEditorEditableState.ts`

**Problem:** Selects `state.settings.metadata` (whole object) — any metadata field change triggers effect deps `[editor, metadata]`, even if only `title` changed.

**Fix:** Select only the fields that matter: `metadata.readOnly`, `metadata.ownerId`, etc.

### 1.4 Migrate toolbar to `useEditorState` (deferred — Tier 2 candidate)

**Current:** `EditorToolbar` uses `useReRenderOnEditorTransaction(editor)` — re-renders on every transaction (every keystroke) to update `isActive` states.

**Better:** TipTap's `useEditorState` with a selector that returns `{ isBold, isItalic, ... }` — only re-renders when the derived state actually changes. This is the officially recommended pattern (TipTap v2.5+).

**Deferred because:** The toolbar pattern touches multiple components and works correctly today. Items 1.1–1.3 are cheaper wins that likely fix the visible jank. Revisit after profiling post-Tier 1.

### 1.5 Fix `providerStatus` stale closure in `useYdocAndProvider.ts`

**Problem:** `providerStatus` is closure-captured in the `handleUpdate` timeout — rapid status changes can desync the saving→synced transition. This is a logic bug (not a re-render issue) but belongs in Tier 1 as a cheap fix that improves sync status reliability.

**Fix:** Use a ref for `providerStatus` in the timeout callback, or restructure the effect deps.

## Tier 2 — Plugin Efficiency for Large Documents

These matter as documents grow. Profile after Tier 1 to confirm priorities.

### 2.1 Deduplicate `transactionAffectsNodeType` checks

**Problem:** HeadingFold, HeadingFilter, HeadingScale, and HeadingDrag each independently check if a transaction affects headings — scanning the same steps 4 times.

**Fix:** Compute once in a shared plugin or memoized helper, cache per transaction.

### 2.2 Eliminate `doc.descendants` in `hoverChatPlugin`

**Problem:** `findHeadingNodes` walks the full document on heading structural changes.

**Fix:** In a flat heading schema, headings are always top-level children — use `doc.forEach` (top-level only) instead of `doc.descendants` (recursive). Already used by HeadingScale/Drag/Fold.

### 2.3 Optimize HeadingFilter for active filters

**Problem:** When filters are active, `matchSections` calls `nodesBetween` per section for text search — expensive on large documents with many sections.

**Fix:** Limit search to changed sections (use `tr.mapping` to identify affected ranges), or debounce filter computation.

### 2.4 Reduce Yjs-origin forced decoration rebuilds

**Problem:** Multiple plugins force full decoration rebuilds on Yjs-origin transactions (`y-sync$`). For large documents, this means multiple `doc.forEach` passes per remote edit.

**Fix:** Share the "Yjs changed this transaction" signal, and batch decoration rebuilds where possible. Consider whether mapping is safe for Yjs transactions (it usually is for text-only changes).

## Tier 3 — Collaboration at Scale (Client-Side)

These matter with many concurrent users (10+). Lower priority unless you're actively scaling. Server-side scaling concerns are covered in `2026-03-26-server-performance-brainstorm.md`.

### 3.1 Throttle awareness at the network level

**Problem:** Yjs awareness updates fire for every cursor move and selection change across all connected users. Item 1.2 throttles the **store update** (React side). This item addresses the **network side** — reducing how often awareness fields are sent over the wire.

**Fix:** Throttle `provider.setAwarenessField('user', ...)` calls in `useProviderAwareness.ts` (e.g., 300ms for cursor position). Reduces WebSocket traffic and remote client processing.

## What NOT to Do

- **Don't split the Zustand store** — fix selectors first, which is 90% of the re-render problem. Store architecture redesign is unnecessary.
- **Don't add viewport-based rendering** — ProseMirror keeps full DOM; virtualizing it is extremely complex and breaks collaboration. Community consensus: split by section if docs are truly huge.
- **Don't replace `useReRenderOnEditorTransaction`** immediately — it works correctly; `useEditorState` is better but lower priority than the store fixes.
- **Don't optimize plugins before profiling** — Tier 2 items are educated guesses; let the profiler confirm which are actually hot.

**Measurement:** Profile with React DevTools Profiler + `console.count('render')` before and after Tier 1. This validates the fixes and guides Tier 2 priorities.

## Scope of Changes

| Tier | Files                                                           | Effort                           |
| ---- | --------------------------------------------------------------- | -------------------------------- |
| 1.1  | `useTocActions.tsx` + audit other selectorless calls            | Small — selector fix             |
| 1.2  | `useProviderAwareness.ts`                                       | Small — add store throttle       |
| 1.3  | `useEditorEditableState.ts`                                     | Small — narrow selector          |
| 1.4  | Deferred to post-Tier 1 profiling                               | Medium — toolbar pattern change  |
| 1.5  | `useYdocAndProvider.ts`                                         | Small — ref fix                  |
| 2.1  | `shared/transaction-affects-node-type.ts` + all heading plugins | Medium — shared cache            |
| 2.2  | `hoverChatPlugin.ts`                                            | Small — swap descendants→forEach |
| 2.3  | `heading-filter-plugin.ts`                                      | Medium — incremental filtering   |
| 2.4  | Multiple heading plugins                                        | Medium — shared Yjs signal       |
| 3.1  | `useProviderAwareness.ts`                                       | Small — network throttle         |

## Research Sources

- [TipTap — Integration performance](https://tiptap.dev/docs/guides/performance)
- [ProseMirror Guide — Efficient updating, Decorations](https://prosemirror.net/docs/guide/)
- [discuss.PM — Decoration caching tips (Marijn)](https://discuss.prosemirror.net/t/any-tips-for-caching-improving-performance-of-decorations/8044)
- [discuss.PM — Large decoration sets](https://discuss.prosemirror.net/t/responsivness-improvements-for-rendering-of-a-large-set-of-decorations/8834)
- [discuss.PM — Large doc performance](https://discuss.prosemirror.net/t/need-help-to-improve-editor-performance/8860)
- [discuss.PM — Decorations in plugin state](https://discuss.prosemirror.net/t/decorations-performance/2381)
- [TipTap #5599 — ReactNodeViewRenderer performance](https://github.com/ueberdosis/tiptap/issues/5599)
- [TipTap #7055 — DragHandle large doc performance](https://github.com/ueberdosis/tiptap/issues/7055)
- [Hocuspocus — Scalability guide](https://tiptap.dev/docs/hocuspocus/guides/scalability)
- [yjs#675 — Large update encode/decode](https://github.com/yjs/yjs/issues/675)
- [yjs#415 — State vector cost with many clients](https://github.com/yjs/yjs/issues/415)
- [yjs#732 — Awareness traffic](https://github.com/yjs/yjs/issues/732)
- [Stepwise — ProseMirror collab performance](https://stepwisehq.com/blog/2023-07-25-prosemirror-collab-performance/)
- [GitHub #911 — Block node quadratic behavior](https://github.com/ProseMirror/prosemirror/issues/911)

## Next Steps

→ `/workflows:plan` for implementation details (start with Tier 1)
