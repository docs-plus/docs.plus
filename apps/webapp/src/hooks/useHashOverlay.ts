import { clearHistoryHash } from '@components/pages/history/historyShareUrl'
import type { TabType } from '@components/settings/types'
import { splitHashRoute } from '@utils/splitHashRoute'
import { useMemo } from 'react'

import { useLocationHash } from './useLocationHash'

const NOTIFICATIONS_ROUTE = 'notifications'
const SETTINGS_ROUTE = 'settings'
const TAB_QUERY = 'tab'

/** A new `TabType` member breaks this build on purpose, so the parser cannot fall behind. */
const SETTINGS_TABS: Record<TabType, true> = {
  profile: true,
  documents: true,
  appearance: true,
  security: true,
  notifications: true
}

export type HashOverlay = {
  overlay: 'notifications' | 'settings' | null
  /** Only ever set when `overlay` is `settings` and the tab name is known. */
  settingsTab: TabType | null
}

function toSettingsTab(value: string | null): TabType | null {
  if (!value) return null
  return SETTINGS_TABS[value as TabType] === true ? (value as TabType) : null
}

/** Pure. Reads the two overlay routes out of the shared `#<route>?<query>` split. */
export function parseOverlayHash(hash: string): HashOverlay {
  const { route, search } = splitHashRoute(hash)

  if (route === NOTIFICATIONS_ROUTE) {
    return { overlay: 'notifications', settingsTab: null }
  }
  if (route !== SETTINGS_ROUTE) {
    return { overlay: null, settingsTab: null }
  }
  const tab = new URLSearchParams(search).get(TAB_QUERY)
  return { overlay: 'settings', settingsTab: toSettingsTab(tab) }
}

/**
 * Drops the hash without a reload, and wakes the same listeners a hashchange would.
 * The guard is the whole reason this exists: `clearHistoryHash` drops ANY hash, and
 * `#history` is a view that must survive. The write itself is the history module's.
 */
export function clearOverlayHash(): void {
  if (parseOverlayHash(window.location.hash).overlay == null) return
  clearHistoryHash()
}

/**
 * An email link arrives on a cold load, so the first read matters more here than any
 * listener. The subscription is shared with the history-hash reader.
 */
export function useHashOverlay(): HashOverlay {
  const hash = useLocationHash()
  return useMemo(() => parseOverlayHash(hash), [hash])
}
