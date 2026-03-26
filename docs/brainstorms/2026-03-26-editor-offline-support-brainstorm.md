---
date: 2026-03-26
topic: editor-offline-support
---

# Editor Offline Support

## What We're Building

Resilient reconnect via `y-indexeddb` — local IndexedDB cache so edits survive tab close, browser refresh, and brief disconnections. On reconnect, Yjs CRDT auto-merges local and remote changes with zero user intervention.

The `ProviderSyncStatus` indicator gets a new "offline with local cache" state so users know their work is safe.

## Why This Approach

**Approach chosen:** Wire `IndexeddbPersistence` alongside the existing `HocuspocusProvider` on the same `Y.Doc`.

**Approaches considered:**

| Approach                                       | Verdict                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| A. IDB provider alongside WebSocket (chosen)   | Standard Yjs pattern, ~50 LOC, zero server changes, codebase already 80% wired for it |
| B. IDB + Service Worker                        | Overengineering for resilient-reconnect scope; can add SW later as separate feature   |
| C. Custom persistence (localStorage/Cache API) | Reinventing the wheel; storage limits make it impractical                             |

**Why A wins:** The hocuspocus server already persists Y binary state. The `useYdocAndProvider` hook has a commented-out IDB block showing this was the original intent. TipTap's official docs prescribe exactly this. Community confirms CRDT conflicts are a non-issue — the real concerns are init ordering and IDB reliability, both addressable with defensive code.

## Key Decisions

- **Scope:** Resilient reconnect only (edits survive disconnection/refresh). Not full offline-first or PWA.
- **Conflict strategy:** Trust Yjs CRDT auto-merge. No manual resolution UI.
- **Server changes:** None. Server already stores `Y.encodeStateAsUpdate` binary — compatible with IDB sync.
- **Status indicator:** Update `ProviderSyncStatus` to show "Offline — changes saved locally" when disconnected and IDB is active. Subtle visual cue that local cache is working.
- **IDB document key:** Use the same `documentId` (room name) for both `IndexeddbPersistence` and `HocuspocusProvider` — required for correct sync.
- **Init ordering:** Create `IndexeddbPersistence` before `HocuspocusProvider` so local cache loads first (near-instant). Do **not** gate `providerSyncing` on IDB — the WebSocket sync remains the authoritative readiness signal. IDB syncing in the background prevents the storage-growth issue (writes before IDB loads → duplicate entries).
- **Error handling:** Wrap IDB in try/catch with graceful degradation. If IDB fails (Safari quirks, storage eviction), editor still works — just without local persistence. Log warning, don't crash.
- **Cleanup:** `IndexeddbPersistence.destroy()` in the same cleanup path as `HocuspocusProvider.destroy()`.
- **Multi-tab:** y-indexeddb handles cross-tab sync via IDB natively. Two tabs on the same doc share the IDB store — no special handling needed.

## Scope of Changes

| File                                                                             | Change                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/webapp/src/hooks/useYdocAndProvider.ts`                                | Create `IndexeddbPersistence` on the same `Y.Doc`, handle `synced` event, destroy on cleanup |
| `packages/webapp/src/components/TipTap/pad-title-section/ProviderSyncStatus.tsx` | Add "offline + locally cached" status variant with appropriate icon/text                     |
| `packages/webapp/src/stores/workspace.ts`                                        | No changes — IDB is a cache, not a loading gate; existing `providerSyncing` is sufficient    |

## IDB Size Management

**Strategy:** Trust defaults + graceful degradation.

- y-indexeddb auto-compacts at ~500 incremental records
- Every successful WebSocket reconnect writes compacted full state → IDB naturally shrinks
- Server is always source of truth; IDB is a best-effort cache
- Catch `QuotaExceededError` on IDB writes → degrade to online-only (log warning, don't crash)
- Safari Private Mode: IDB unavailable → skip silently (current behavior)
- No stale cache cleanup, no per-doc size limits, no storage monitoring UI — those are overengineering for a cache layer

**Storage limits reference:** Chrome ~80% disk, Firefox ~2GB, iOS Safari ~1GB. A typical Y.Doc is 5-50KB; even heavy offline editing = 100-500KB/day. Non-issue at these limits.

## Community Concerns Addressed

| Concern                                  | Mitigation                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| IndexedDB storage growth on refresh      | Wait for IDB `synced` before allowing Yjs writes; IDB compacts automatically on sync |
| Safari/iOS IndexedDB flakiness           | Defensive try/catch around IDB creation; graceful degradation to online-only         |
| Init race (IDB vs WebSocket vs defaults) | IDB syncs first (local is fastest), then WS provider syncs server state — Yjs merges |
| Closed DB → editor stops syncing         | Error listener on IDB; if it fails, log and continue without local persistence       |
| Mobile storage eviction                  | IDB is best-effort cache; server remains source of truth; no data loss               |

## Open Questions

None — scope is well-defined and the implementation pattern is standard.

## Research Sources

- [TipTap Offline Support](https://tiptap.dev/docs/guides/offline-support)
- [y-indexeddb docs](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb)
- [yjs/y-indexeddb#31](https://github.com/yjs/y-indexeddb/issues/31) — storage growth on refresh
- [yjs/y-indexeddb#44](https://github.com/yjs/y-indexeddb/issues/44) — Safari/iOS failures
- [yjs/yjs#650](https://github.com/yjs/yjs/issues/650) — closed DB error handling
- [discuss.yjs.dev#984](https://discuss.yjs.dev/t/refreshing-page-causes-y-indexeddb-to-accumulate-db-entries/984) — init ordering
- [discuss.yjs.dev#1742](https://discuss.yjs.dev/t/indexeddb-takes-up-a-lot-of-space/1742) — storage size
- [MDN Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## Next Steps

→ `/workflows:plan` for implementation details
