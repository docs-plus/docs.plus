import * as toast from '@components/toast'
import { useLocationHash } from '@hooks/useLocationHash'
import type { HistoryItem } from '@types'
import { copyToClipboard } from '@utils/clipboard'
import { splitHashRoute } from '@utils/splitHashRoute'
import { useMemo } from 'react'

import { formatVersionDate } from './helpers'

const HISTORY_ROUTE = 'history'
const VERSION_QUERY = 'version'

export type ParsedHistoryHash = {
  isHistory: boolean
  /** Valid version from hash, or null if absent / invalid query. */
  version: number | null
  /** `version` query present but not a finite number. */
  versionQueryInvalid: boolean
}

export function parseHistoryHash(hash: string): ParsedHistoryHash {
  const { route, search } = splitHashRoute(hash)
  if (route !== HISTORY_ROUTE) {
    return { isHistory: false, version: null, versionQueryInvalid: false }
  }
  const params = new URLSearchParams(search)
  if (!params.has(VERSION_QUERY)) {
    return { isHistory: true, version: null, versionQueryInvalid: false }
  }
  const v = params.get(VERSION_QUERY)
  if (v === null || v === '') {
    return { isHistory: true, version: null, versionQueryInvalid: true }
  }
  const n = Number(v)
  if (!Number.isFinite(n)) {
    return { isHistory: true, version: null, versionQueryInvalid: true }
  }
  return { isHistory: true, version: n, versionQueryInvalid: false }
}

/**
 * An in-app link writes `#history` on a live page, so the listener matters as much as
 * the first read. The subscription is shared with the overlay-hash reader.
 */
export function useHistoryHash(): ParsedHistoryHash {
  const hash = useLocationHash()
  return useMemo(() => parseHistoryHash(hash), [hash])
}

export function buildHistoryShareUrl(version: number): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${HISTORY_ROUTE}?${VERSION_QUERY}=${version}`
}

/** `pushState` / `replaceState` never fire `hashchange`, so every hash reader would miss the write. */
export function notifyHashChange(oldURL: string): void {
  const newURL = window.location.href
  if (oldURL === newURL) return
  try {
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }))
  } catch {
    window.dispatchEvent(new Event('hashchange'))
  }
}

function updateAppUrl(method: 'push' | 'replace', url: string): void {
  const oldURL = window.location.href
  // A replace rewrites THIS entry, so its router state must survive. Next reads
  // `e.state` on popstate, and a null there makes Back rewrite the address bar
  // instead of routing. A push mints a new entry, and copying the state onto it
  // would give two entries one index, so that arm keeps null.
  if (method === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(window.history.state, '', url)
  notifyHashChange(oldURL)
}

/** In-app navigation that must wake hash listeners (e.g. editor link → `#history`). */
export function pushAppUrlThenNotifyHashChange(pathWithSearchAndHash: string): void {
  updateAppUrl('push', pathWithSearchAndHash)
}

export function replaceHistoryHashVersion(version: number | null): void {
  const { pathname, search } = window.location
  const url =
    version == null
      ? `${pathname}${search}`
      : `${pathname}${search}#${HISTORY_ROUTE}?${VERSION_QUERY}=${version}`
  updateAppUrl('replace', url)
}

export function clearHistoryHash(): void {
  replaceHistoryHashVersion(null)
}

export function normalizeToPlainHistoryHash(): void {
  const p = parseHistoryHash(window.location.hash)
  if (!p.isHistory) return
  if (p.version == null && !p.versionQueryInvalid) return
  const { pathname, search } = window.location
  updateAppUrl('replace', `${pathname}${search}#${HISTORY_ROUTE}`)
}

export function pickHistoryListItem(
  list: HistoryItem[],
  version: number | null
): HistoryItem | null {
  if (!list.length) return null
  if (version != null) {
    const match = list.find((item) => item.version === version)
    if (match) return match
  }
  return list[0] ?? null
}

export function resolveHistoryListTargetVersion(
  list: HistoryItem[],
  hash: string
): { targetVersion: number; invalidDeepLink: boolean } | null {
  const head = list[0]
  if (!head) {
    return null
  }
  const parsed = parseHistoryHash(hash)
  if (!parsed.isHistory) {
    return { targetVersion: head.version, invalidDeepLink: false }
  }
  if (parsed.versionQueryInvalid) {
    return { targetVersion: head.version, invalidDeepLink: true }
  }
  if (parsed.version == null) {
    return { targetVersion: head.version, invalidDeepLink: false }
  }
  if (!list.some((item) => item.version === parsed.version)) {
    return { targetVersion: head.version, invalidDeepLink: true }
  }
  return { targetVersion: parsed.version, invalidDeepLink: false }
}

/** Tooltip and `aria-label`. Uses the same clock the list shows. The URL still carries the id. */
export function copyVersionLinkTitle(createdAt: string): string {
  const { date, time } = formatVersionDate(createdAt)
  return `Copy link to the version from ${date} at ${time}`
}

export async function copyHistoryVersionLinkToClipboard(version: number): Promise<void> {
  const url = buildHistoryShareUrl(version)
  const ok = await copyToClipboard(url)
  if (ok) {
    toast.Success('Link copied')
  } else {
    toast.Error("Couldn't copy link")
  }
}
