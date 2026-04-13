import * as toast from '@components/toast'
import type { HistoryItem } from '@types'
import { copyToClipboard } from '@utils/clipboard'

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
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) {
    return { isHistory: false, version: null, versionQueryInvalid: false }
  }
  const q = raw.indexOf('?')
  const route = q === -1 ? raw : raw.slice(0, q)
  const search = q === -1 ? '' : raw.slice(q)
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

export function buildHistoryShareUrl(version: number): string {
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${HISTORY_ROUTE}?${VERSION_QUERY}=${version}`
}

/** `history.replaceState` does not fire `hashchange`; hooks like `useHashRouter` need a synthetic event. */
function replaceStateThenNotifyHashChange(url: string): void {
  const oldURL = window.location.href
  window.history.replaceState(null, '', url)
  const newURL = window.location.href
  if (oldURL === newURL) return
  try {
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }))
  } catch {
    window.dispatchEvent(new Event('hashchange'))
  }
}

export function replaceHistoryHashVersion(version: number | null): void {
  const { pathname, search } = window.location
  const url =
    version == null
      ? `${pathname}${search}`
      : `${pathname}${search}#${HISTORY_ROUTE}?${VERSION_QUERY}=${version}`
  replaceStateThenNotifyHashChange(url)
}

/** Clear `#history…` and return to the editor URL (pathname + search only). */
export function clearHistoryHash(): void {
  replaceHistoryHashVersion(null)
}

/** If the URL is `#history?…`, collapse to `#history` only (no query). No-op if not in history or already plain. */
export function normalizeToPlainHistoryHash(): void {
  const p = parseHistoryHash(window.location.hash)
  if (!p.isHistory) return
  if (p.version == null && !p.versionQueryInvalid) return
  const { pathname, search } = window.location
  replaceStateThenNotifyHashChange(`${pathname}${search}#${HISTORY_ROUTE}`)
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

/** Tooltip and `aria-label` for copy-version-link controls (parallel to restore: “…to version N”). */
export function copyVersionLinkTitle(version: number): string {
  return `Copy link to version ${version}`
}

export async function copyHistoryVersionLinkToClipboard(version: number): Promise<void> {
  const url = buildHistoryShareUrl(version)
  const ok = await copyToClipboard(url)
  if (ok) {
    toast.Success(`Link to version ${version} copied`)
  } else {
    toast.Error("Couldn't copy link")
  }
}
