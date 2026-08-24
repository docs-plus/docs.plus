import { getDefaultController } from '@docs.plus/extension-hyperlink'
import { useSyncExternalStore } from 'react'

import type { ActivePopover } from './types'

/**
 * Bus from desktop popover entries (called outside React) to
 * `HyperlinkPopoverPortal`. Module value + `useSyncExternalStore`; no
 * zustand or Context.
 */

let active: ActivePopover | null = null
const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const setActivePopover = (next: ActivePopover | null): void => {
  active = next
  listeners.forEach((l) => l())
}

export const useActivePopover = (): ActivePopover | null =>
  useSyncExternalStore(
    subscribe,
    () => active,
    () => null
  )

// One-time subscription at module load. Idle = Apply / click-outside /
// Esc / scroll-stickiness loss / route change. Flag on `globalThis`
// prevents duplicate listeners under HMR / Jest module-cache replays.
const SUBSCRIPTION_FLAG = '__hyperlinkControllerSubscribed'
const g = globalThis as Record<string, unknown>
if (!g[SUBSCRIPTION_FLAG]) {
  g[SUBSCRIPTION_FLAG] = true
  getDefaultController().subscribe((state) => {
    if (state.kind === 'idle') setActivePopover(null)
  })
}
