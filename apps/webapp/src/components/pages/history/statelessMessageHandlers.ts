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
  HISTORY_RESPONSE,
  HISTORY_SAVED_MSG
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

function clearEmptyHistory(deps: HistoryStatelessHandlerDeps, notify: () => void) {
  store().setPendingWatchVersion(null)
  store().setHistoryList([])
  store().setActiveHistory(null)
  store().setLatestSnapshot(null)
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

  const snapshot = store().latestSnapshot
  if (
    snapshot &&
    snapshot.version === sidebarItem.version &&
    tryHydrateVersion(
      deps,
      snapshot,
      'History: could not decode latest snapshot after watch failed'
    )
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
    // A failure frame echoes no version. With only the compare slot open it is
    // compare's, and the recovery path would evict the row the reader is viewing.
    if (store().pendingCompareVersion != null && failedVersion == null) {
      // Leaving compareMode on with no base strands the sidebar: every row click
      // reassigns an A side that never renders, so no version can be opened.
      store().setPendingCompareVersion(null)
      store().setCompareMode(false)
      store().setCompareBaseItem(null)
      toast.Error("Can't compare this version")
      return
    }
    toast.Error('Could not open this version. Try another or go back to the editor.')
    recoverAfterWatchFailure(deps, failedVersion)
    return
  }

  if (failedType === 'history.list') {
    // A background refresh nobody asked for must not blank the sidebar or drop
    // the version from the URL; the reader keeps what they already have.
    if (store().silentListRefresh) {
      store().setSilentListRefresh(false)
      return
    }
    toast.Error('Could not load version history.')
    store().setHistoryList([])
    store().setActiveHistory(null)
    store().setLatestSnapshot(null)
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

  // Read and clear first: any list response ends the silent window. One lost reply
  // otherwise latches the flag, and every later failure is swallowed with the spinner up.
  const silent = store().silentListRefresh
  if (silent) store().setSilentListRefresh(false)

  let list: HistoryItem[]
  let latestSnapshot: HistoryItem | null | undefined
  let profiles: HistoryProfileMap
  let clientAuthors: ClientAuthorBinding[]

  if (raw == null) {
    if (silent) return
    clearEmptyHistory(deps, () => toast.Error('Could not load version history.'))
    return
  }
  if (Array.isArray(raw)) {
    list = raw
    latestSnapshot = undefined
    profiles = {}
    clientAuthors = []
  } else {
    list = raw.versions ?? []
    latestSnapshot = raw.latestSnapshot ?? null
    profiles = raw.profiles ?? {}
    clientAuthors = raw.clientAuthors ?? []
  }

  const head = list[0]
  if (!list.length || !head) {
    if (silent) return
    clearEmptyHistory(deps, () => toast.Info('No saved versions for this document yet.'))
    return
  }

  store().setHistoryList(list)
  store().setLatestSnapshot(latestSnapshot ?? null)
  store().setProfiles(profiles)
  store().setClientAuthors(clientAuthors)

  if (silent) return

  if (store().pendingWatchVersion != null) {
    return
  }

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

  if (latestSnapshot?.data != null && latestSnapshot.version === targetVersion) {
    applySnapshot(deps, latestSnapshot, 'History: could not decode latest snapshot')
    return
  }

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
    // A failure carries no version, so it can only be attributed when one request
    // is outstanding. With both in flight the viewed version wins and the compare
    // request is left for compare exit to clear.
    if (pendingCompare != null && pending == null) {
      store().setPendingCompareVersion(null)
      store().setCompareMode(false)
      store().setCompareBaseItem(null)
      toast.Error('Could not load the version to compare against.')
      return
    }
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
