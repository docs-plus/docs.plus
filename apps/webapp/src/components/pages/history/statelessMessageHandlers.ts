import {
  normalizeToPlainHistoryHash,
  parseHistoryHash,
  pickHistoryListItem,
  replaceHistoryHashVersion,
  resolveHistoryListTargetVersion
} from '@components/pages/history/historyShareUrl'
import type { HistoryStatelessPayload } from '@components/pages/history/historyStatelessWire'
import { HISTORY_ERROR, HISTORY_RESPONSE } from '@components/pages/history/historyStatelessWire'
import * as toast from '@components/toast'
import type { Editor } from '@tiptap/react'
import type { HistoryItem } from '@types'

import { applyHistoryItemToEditor, resolveHistoryApplyResult } from './applyHistoryToEditor'
import type { WatchVersionContentOptions } from './hooks/useVersionContent'

export type HistoryStatelessHandlerDeps = {
  setHistoryList: (list: HistoryItem[]) => void
  setActiveHistory: (item: HistoryItem | null) => void
  setLatestSnapshot: (item: HistoryItem | null) => void
  setLoadingHistory: (loading: boolean) => void
  setPendingWatchVersion: (version: number | null) => void
  getEditor: () => Editor | null
  getHistoryList: () => HistoryItem[]
  getLatestSnapshot: () => HistoryItem | null
  getPendingWatchVersion: () => number | null
  watchVersionContent: (version: number, options?: WatchVersionContentOptions) => void
}

function clearEmptyHistory(deps: HistoryStatelessHandlerDeps, notify: () => void) {
  deps.setPendingWatchVersion(null)
  deps.setHistoryList([])
  deps.setActiveHistory(null)
  deps.setLatestSnapshot(null)
  deps.setLoadingHistory(false)
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
  const list = deps.getHistoryList()
  const head = list[0]
  if (!head) {
    deps.setPendingWatchVersion(null)
    deps.setLoadingHistory(false)
    return
  }

  const sidebarItem = pickHistoryListItem(list, failedVersion) ?? head
  deps.setActiveHistory(sidebarItem)
  deps.setPendingWatchVersion(null)

  if (
    tryHydrateVersion(deps, sidebarItem, 'History: could not decode list row after watch failed')
  ) {
    return
  }

  const snapshot = deps.getLatestSnapshot()
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
    deps.setHistoryList(remaining)
    toast.Error("That version isn't available anymore")

    const fallback = remaining[0]
    if (!fallback) {
      deps.setActiveHistory(null)
      deps.setLoadingHistory(false)
      normalizeToPlainHistoryHash()
      return
    }

    deps.setActiveHistory(fallback)
    if (
      tryHydrateVersion(deps, fallback, 'History: could not decode fallback row after eviction')
    ) {
      return
    }
    deps.setLoadingHistory(true)
    deps.watchVersionContent(fallback.version, { updateUrl: false })
    return
  }

  deps.setLoadingHistory(true)
  deps.watchVersionContent(sidebarItem.version, { updateUrl: false })
}

function applySnapshot(deps: HistoryStatelessHandlerDeps, item: HistoryItem, logMessage: string) {
  deps.setActiveHistory(item)
  deps.setPendingWatchVersion(null)
  resolveHistoryApplyResult(applyHistoryItemToEditor(deps.getEditor(), item), {
    logMessage,
    setLoadingHistory: deps.setLoadingHistory
  })
}

function handleHistoryFailed(payload: HistoryStatelessPayload, deps: HistoryStatelessHandlerDeps) {
  const failedType = payload.type
  const failedVersion = deps.getPendingWatchVersion()

  if (failedType === 'history.watch') {
    toast.Error('Could not open this version. Try another or go back to the editor.')
    recoverAfterWatchFailure(deps, failedVersion)
    return
  }

  if (failedType === 'history.list') {
    toast.Error('Could not load version history.')
    deps.setHistoryList([])
    deps.setActiveHistory(null)
    deps.setLatestSnapshot(null)
    normalizeToPlainHistoryHash()
  } else {
    toast.Error('Something went wrong loading history.')
  }

  deps.setPendingWatchVersion(null)
  deps.setLoadingHistory(false)
}

function handleHistoryList(payload: HistoryStatelessPayload, deps: HistoryStatelessHandlerDeps) {
  const raw = payload.response as
    | HistoryItem[]
    | { versions: HistoryItem[]; latestSnapshot: HistoryItem | null }
    | null
    | undefined

  let list: HistoryItem[]
  let latestSnapshot: HistoryItem | null | undefined

  if (raw == null) {
    clearEmptyHistory(deps, () => toast.Error('Could not load version history.'))
    return
  }
  if (Array.isArray(raw)) {
    list = raw
    latestSnapshot = undefined
  } else {
    list = raw.versions ?? []
    latestSnapshot = raw.latestSnapshot ?? null
  }

  const head = list[0]
  if (!list.length || !head) {
    clearEmptyHistory(deps, () => toast.Info('No saved versions for this document yet.'))
    return
  }

  deps.setHistoryList(list)
  deps.setLatestSnapshot(latestSnapshot ?? null)

  if (deps.getPendingWatchVersion() != null) {
    return
  }

  const resolved = resolveHistoryListTargetVersion(list, window.location.hash)
  if (resolved == null) {
    deps.setPendingWatchVersion(null)
    deps.setLoadingHistory(false)
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
  const pending = deps.getPendingWatchVersion()

  if (response == null) {
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
  }
}
