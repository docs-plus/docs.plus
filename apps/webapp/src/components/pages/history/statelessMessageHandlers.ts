import {
  clearHistoryHash,
  normalizeToPlainHistoryHash,
  parseHistoryHash,
  pickHistoryListItem,
  replaceHistoryHashVersion,
  resolveHistoryListTargetVersion
} from '@components/pages/history/historyShareUrl'
import type {
  HistoryListWireResponse,
  HistoryRevertWireResponse,
  HistoryStatelessPayload
} from '@components/pages/history/historyStatelessWire'
import {
  HISTORY_ERROR,
  HISTORY_LIST_GAP_MS,
  HISTORY_RESPONSE,
  HISTORY_SAVED_MSG,
  sendHistoryListRequest
} from '@components/pages/history/historyStatelessWire'
import * as toast from '@components/toast'
import { useStore } from '@stores'
import type {
  ClientAuthorBinding,
  HistoryItem,
  HistoryProfileMap,
  VersionFailureReason
} from '@types'

import { applyHistoryItemToEditor, resolveHistoryApplyResult } from './applyHistoryToEditor'
import type { WatchVersionContentOptions } from './hooks/useVersionContent'

/**
 * Only the two callbacks that close over the provider and documentId are injected.
 * Everything else reads the store directly. This module has no tests, so threading
 * twenty setters through a deps object bought no testability. It also made adding a
 * store field a four-file edit, which is how `setCompareMode` came to be missing.
 */
type HistoryStatelessHandlerDeps = {
  requestSilentListRefresh: () => void
  watchVersionContent: (version: number, options?: WatchVersionContentOptions) => void
}

const store = () => useStore.getState()

const REVERT_FAILURE_MESSAGE: Record<VersionFailureReason, string> = {
  unauthorized: 'Sign in to restore a version.',
  'read-only': 'This document is read-only. You cannot restore a version.',
  'not-found':
    'This version is no longer available, so we removed it from the list. Nothing changed.',
  'invalid-content': 'This version cannot be read, so it cannot be restored. Try another version.',
  // Residual case only. Two of its three causes are now split out above, so what is
  // left genuinely cannot promise the document was untouched — do not add reassurance.
  'persist-failed':
    'We could not confirm the restore. Go back to the editor and check the document before you try again.',
  'draft-document': 'This document has not been saved yet, so there is nothing to restore.',
  // Keyed per document, so a collaborator's restore refuses yours and nothing on the
  // wire tells them apart. The copy must not say the reader did something twice.
  'rate-limited':
    'A restore just ran in this document. Yours did not run. Wait a few seconds, check the document, then try again if you still need to.'
}

const DEEP_LINK_PAGE_CAP = 40
// Module scope is safe: every history mount calls cancelDeepLinkWalk before its first reply.
let deepLinkPages = 0
let deepLinkRetried = false
let walkTimer: ReturnType<typeof setTimeout> | undefined

export function cancelDeepLinkWalk(): void {
  clearTimeout(walkTimer)
  walkTimer = undefined
  deepLinkPages = 0
  deepLinkRetried = false
}

/** The hash names a version below every loaded page, and an older page could still hold it. */
function deepLinkBelowLoaded(list: HistoryItem[]): boolean {
  const version = parseHistoryHash(window.location.hash).version
  const before = store().historyNextBefore
  return (
    version != null &&
    before != null &&
    store().historyHasMore &&
    version < before &&
    !list.some((item) => item.version === version)
  )
}

function isDeepLinkWalk(list: HistoryItem[]): boolean {
  return store().loadingHistory && store().pendingWatchVersion == null && deepLinkBelowLoaded(list)
}

function pageTowardDeepLink() {
  // One timer only: a second copy of the same request trips the list cooldown.
  clearTimeout(walkTimer)
  walkTimer = setTimeout(() => {
    walkTimer = undefined
    // A null provider unmounts the history view, and the next mount cancels the walk.
    const { hocuspocusProvider, metadata } = store().settings
    const beforeVersion = store().historyNextBefore
    if (!hocuspocusProvider || beforeVersion == null || !isDeepLinkWalk(store().historyList)) return
    sendHistoryListRequest(hocuspocusProvider, metadata?.documentId, { beforeVersion })
  }, HISTORY_LIST_GAP_MS)
}

function clearEmptyHistory(deps: HistoryStatelessHandlerDeps, notify: () => void) {
  store().setPendingWatchVersion(null)
  store().setHistoryList([])
  store().setActiveHistory(null)
  store().setLoadingHistory(false)
  notify()
  normalizeToPlainHistoryHash()
}

function tryHydrateVersion(
  deps: HistoryStatelessHandlerDeps,
  item: HistoryItem,
  logMessage: string
): boolean {
  if (item.data == null) return false
  applySnapshot(deps, item, logMessage)
  return true
}

function recoverAfterWatchFailure(deps: HistoryStatelessHandlerDeps, failedVersion: number | null) {
  const list = store().historyList
  const head = list[0]
  if (!head) {
    store().setPendingWatchVersion(null)
    store().setLoadingHistory(false)
    return
  }

  const sidebarItem = pickHistoryListItem(list, failedVersion) ?? head
  store().setActiveHistory(sidebarItem)
  store().setPendingWatchVersion(null)

  if (
    tryHydrateVersion(deps, sidebarItem, 'History: could not decode list row after watch failed')
  ) {
    return
  }

  // Re-requesting the version that just failed loops forever — the row may
  // have been pruned server-side while the sidebar list was stale. Evict it
  // and fall back to the newest remaining version instead.
  if (failedVersion != null && sidebarItem.version === failedVersion) {
    const remaining = list.filter((item) => item.version !== failedVersion)
    store().setHistoryList(remaining)
    toast.Error("That version isn't available anymore")

    const fallback = remaining[0]
    if (!fallback) {
      store().setActiveHistory(null)
      store().setLoadingHistory(false)
      normalizeToPlainHistoryHash()
      return
    }

    store().setActiveHistory(fallback)
    if (
      tryHydrateVersion(deps, fallback, 'History: could not decode fallback row after eviction')
    ) {
      return
    }
    store().setLoadingHistory(true)
    deps.watchVersionContent(fallback.version, { updateUrl: false })
    return
  }

  store().setLoadingHistory(true)
  deps.watchVersionContent(sidebarItem.version, { updateUrl: false })
}

function applySnapshot(deps: HistoryStatelessHandlerDeps, item: HistoryItem, logMessage: string) {
  store().setActiveHistory(item)
  store().setPendingWatchVersion(null)
  resolveHistoryApplyResult(applyHistoryItemToEditor(store().editor, item), {
    logMessage,
    setLoadingHistory: store().setLoadingHistory
  })
}

function handleHistoryFailed(payload: HistoryStatelessPayload, deps: HistoryStatelessHandlerDeps) {
  const failedType = payload.type
  const failedVersion = store().pendingWatchVersion

  // Before the shared tail: a refused restore must not clear a watch the reader
  // still has in flight. A refused restore also has no bearing on what the sidebar shows.
  if (failedType === 'history.revert') {
    // The fallback is load-bearing: three revert failures carry no reason — ops not
    // wired, missing room name, and a documentId mismatch that echoes the type back.
    const reason = payload.reason
    toast.Error(
      (reason && REVERT_FAILURE_MESSAGE[reason]) ??
        'Could not restore this version. Nothing changed. Try again.'
    )
    store().setLoadingHistory(false)
    return
  }

  if (failedType === 'history.watch') {
    if (payload.reason === 'rate-limited') {
      const watchRefused = store().pendingWatchVersion != null
      const compareRefused = store().pendingCompareVersion != null
      store().setPendingWatchVersion(null)
      store().setPendingCompareVersion(null)
      store().setLoadingHistory(false)
      // Same strand as the compare arm below: compare mode with no base blocks every row.
      if (compareRefused && !watchRefused && store().compareBaseItem == null) {
        store().setCompareMode(false)
      }
      // The URL already names the refused version; point it back at what the editor shows.
      const active = store().activeHistory
      if (watchRefused && active && parseHistoryHash(window.location.hash).version != null) {
        replaceHistoryHashVersion(active.version)
      }
      toast.Info('Too many versions opened at once. Wait a moment and try again.')
      return
    }
    // The echo names the refused version. A failed A must not evict the row
    // the reader is viewing.
    if (payload.version != null && payload.version === store().pendingCompareVersion) {
      // Leaving compareMode on with no base strands the sidebar: every row click
      // reassigns an A side that never renders, so no version can be opened.
      store().setPendingCompareVersion(null)
      store().setCompareMode(false)
      store().setCompareBaseItem(null)
      toast.Error("Can't compare this version")
      return
    }
    // A stale reply that names neither slot must not replace the viewed version.
    if (payload.version != null && payload.version !== failedVersion) return
    toast.Error('Could not open this version. Try another or go back to the editor.')
    recoverAfterWatchFailure(deps, failedVersion)
    return
  }

  if (failedType === 'history.list') {
    // A background refresh nobody asked for must not blank the sidebar or drop
    // the version from the URL; the reader keeps what they already have.
    if (payload.beforeVersion == null && store().silentListRefresh) {
      store().setSilentListRefresh(false)
      return
    }
    // A loaded list means an older page failed. That request never set loading or the
    // watch slot, so skip the shared tail.
    if (store().historyList.length > 0) {
      // Match the echo: a failed first page must not free a Show older still in flight.
      if (payload.beforeVersion === store().pendingOlderBefore) store().setPendingOlderBefore(null)
      if (isDeepLinkWalk(store().historyList)) {
        if (payload.reason === 'rate-limited' && !deepLinkRetried) {
          deepLinkRetried = true
          pageTowardDeepLink()
        } else {
          openResolvedTarget(store().historyList, deps)
        }
        return
      }
      if (payload.reason !== 'rate-limited') toast.Error('Could not load older versions.')
      return
    }
    toast.Error('Could not load version history.')
    store().setHistoryList([])
    store().setActiveHistory(null)
    normalizeToPlainHistoryHash()
  } else {
    toast.Error('Something went wrong loading history.')
  }

  store().setPendingWatchVersion(null)
  store().setLoadingHistory(false)
}

function handleHistoryRevert(payload: HistoryStatelessPayload) {
  const ack = payload.response as HistoryRevertWireResponse | null
  // The server rewrote the live Y.Doc, so the restored text is already arriving over
  // y-sync. Applying it here would race that write. Clear loading before the hash so
  // no skeleton frame paints; the toast host sits outside the unmounted subtree.
  store().setLoadingHistory(false)
  clearHistoryHash()
  // Names the row by the badge a reader can actually see, never by a version number
  // the sidebar never prints. Longer than the 4s default because it carries a recovery
  // instruction, not just a confirmation.
  toast.Success(
    ack
      ? 'Restored. Your document from before is in this list, marked "Pre-restore".'
      : 'Restored. Your document from before is saved in this list.',
    { duration: 8000 }
  )
}

function handleHistoryList(payload: HistoryStatelessPayload, deps: HistoryStatelessHandlerDeps) {
  const raw = payload.response as HistoryListWireResponse | null | undefined

  // An older page is still detected by `raw.beforeVersion`, because old and new
  // servers both send it. Only the failure arm reads the top-level `beforeVersion` echo.
  if (raw != null && !Array.isArray(raw) && raw.beforeVersion != null) {
    // A reply to a cursor the store has moved past would append rows out of place.
    if (raw.beforeVersion !== store().historyNextBefore) return
    const current = store().historyList
    const page = raw.versions ?? []
    const walking = isDeepLinkWalk(current)
    const merged = [
      ...current,
      ...page.filter((item) => !current.some((row) => row.version === item.version))
    ]
    store().setHistoryList(merged)
    store().setProfiles({ ...store().profiles, ...(raw.profiles ?? {}) })
    store().setHistoryHasMore(Boolean(raw.hasMore))
    store().setHistoryNextBefore(raw.nextBefore ?? null)
    store().setPendingOlderBefore(null)
    if (walking) {
      deepLinkRetried = false
      openListTarget(merged, deps)
    }
    return
  }

  // Only a first page can be silent. An older-page frame must not end the silent window.
  // Read and clear first: one lost reply would otherwise latch the flag.
  const silent = store().silentListRefresh
  if (silent) store().setSilentListRefresh(false)

  let list: HistoryItem[]
  let profiles: HistoryProfileMap
  let clientAuthors: ClientAuthorBinding[]

  if (raw == null) {
    if (silent) return
    clearEmptyHistory(deps, () => toast.Error('Could not load version history.'))
    return
  }
  if (Array.isArray(raw)) {
    list = raw
    profiles = {}
    clientAuthors = []
    store().setHistoryHasMore(false)
    store().setHistoryNextBefore(null)
    store().setPendingOlderBefore(null)
  } else {
    const page = raw.versions ?? []
    const current = store().historyList
    const inPage = (row: HistoryItem) => page.some((item) => item.version === row.version)
    if (payload.since != null && raw.anchor) {
      store().setHistoryAnchor({ since: payload.since, item: raw.anchor })
    }

    // A re-list returns page one only. Keep the older pages the reader already
    // loaded, and keep their cursor, or the row they have open disappears.
    // Keep them only when the page reaches the old head; otherwise a gap opens.
    const pageTail = raw.nextBefore ?? Math.min(...page.map((item) => item.version))
    const reachesHead = current[0] != null && pageTail <= current[0].version
    const kept =
      page.length === 0 || !reachesHead
        ? []
        : current.filter((row) => row.version < pageTail && !inPage(row))
    clientAuthors = raw.clientAuthors ?? []
    if (kept.length > 0) {
      list = [...page, ...kept]
      profiles = { ...store().profiles, ...(raw.profiles ?? {}) }
    } else {
      list = page
      profiles = raw.profiles ?? {}
      store().setHistoryHasMore(Boolean(raw.hasMore))
      store().setHistoryNextBefore(raw.nextBefore ?? null)
      // A replaced cursor drops the older-page reply in flight, so free Show older.
      store().setPendingOlderBefore(null)
    }
  }

  const head = list[0]
  if (!list.length || !head) {
    if (silent) return
    clearEmptyHistory(deps, () => toast.Info('No saved versions for this document yet.'))
    return
  }

  store().setHistoryList(list)
  store().setProfiles(profiles)
  store().setClientAuthors(clientAuthors)

  if (silent) return

  if (store().pendingWatchVersion != null) {
    return
  }

  cancelDeepLinkWalk()
  openListTarget(list, deps)
}

/** A shared link can name a version below the loaded pages; page toward it before judging it. */
function openListTarget(list: HistoryItem[], deps: HistoryStatelessHandlerDeps) {
  if (deepLinkPages < DEEP_LINK_PAGE_CAP && deepLinkBelowLoaded(list)) {
    deepLinkPages += 1
    pageTowardDeepLink()
    return
  }
  openResolvedTarget(list, deps)
}

function openResolvedTarget(list: HistoryItem[], deps: HistoryStatelessHandlerDeps) {
  const resolved = resolveHistoryListTargetVersion(list, window.location.hash)
  if (resolved == null) {
    store().setPendingWatchVersion(null)
    store().setLoadingHistory(false)
    return
  }

  const { targetVersion, invalidDeepLink } = resolved
  if (invalidDeepLink) {
    toast.Error("That version isn't available anymore")
    replaceHistoryHashVersion(targetVersion)
  }

  const parsedHash = parseHistoryHash(window.location.hash)
  const syncUrlOnWatch = invalidDeepLink || parsedHash.version != null

  deps.watchVersionContent(targetVersion, { updateUrl: syncUrlOnWatch })
}

function handleHistoryWatch(payload: HistoryStatelessPayload, deps: HistoryStatelessHandlerDeps) {
  const response = payload.response as HistoryItem | null
  const pending = store().pendingWatchVersion
  const pendingCompare = store().pendingCompareVersion

  // Compare's A side rides the same watch channel, so it has to be claimed before
  // the editor path. Otherwise the base version replaces what the reader is viewing.
  if (response != null && pendingCompare != null && pendingCompare === response.version) {
    store().setPendingCompareVersion(null)
    store().setCompareBaseItem(response)
    return
  }

  if (response == null) {
    if (payload.version != null && payload.version === pendingCompare) {
      store().setPendingCompareVersion(null)
      store().setCompareMode(false)
      store().setCompareBaseItem(null)
      toast.Error('Could not load the version to compare against.')
      return
    }
    if (payload.version != null && payload.version !== pending) return
    recoverAfterWatchFailure(deps, pending)
    return
  }

  if (pending !== response.version) {
    return
  }

  applySnapshot(deps, response, `History: could not decode version payload v${response.version}`)
}

export function handleHistoryStatelessPayload(
  payload: HistoryStatelessPayload,
  deps: HistoryStatelessHandlerDeps
): void {
  if (payload.msg === HISTORY_SAVED_MSG) {
    // Broadcast on every collaborator autosave. Skip it when the head already covers
    // that version: `setProfiles` replaces the map wholesale, so a no-op re-list
    // re-renders every mounted row for nothing.
    const head = store().historyList[0]
    if (
      payload.documentId === store().settings.metadata?.documentId &&
      (payload.version == null || head == null || payload.version > head.version)
    ) {
      deps.requestSilentListRefresh()
    }
    return
  }

  if (payload.msg !== HISTORY_RESPONSE) return

  if (payload.error === HISTORY_ERROR) {
    handleHistoryFailed(payload, deps)
    return
  }

  if (payload.type === 'history.list') {
    handleHistoryList(payload, deps)
    return
  }

  if (payload.type === 'history.watch') {
    handleHistoryWatch(payload, deps)
    return
  }

  if (payload.type === 'history.revert') {
    handleHistoryRevert(payload)
  }
}
