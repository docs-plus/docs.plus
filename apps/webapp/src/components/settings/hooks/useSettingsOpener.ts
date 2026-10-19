import { clearOverlayHash, useHashOverlay } from '@hooks/useHashOverlay'
import { selectSettingsMayOpen, useAuthStore } from '@stores'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { SettingsTakeoverProps } from '../SettingsTakeover'
import type { TabType } from '../types'
import { isMobileSurface } from '../utils/isMobileSurface'

/**
 * Sole consumer of the takeover's history entry. Pops it (if present) and resolves once
 * the traversal lands. Callers that navigate next (sign-out) await this instead of guessing.
 */
export const consumeSettingsTakeoverEntry = (): Promise<void> => {
  if (!window.history.state?.settingsTakeover) return Promise.resolve()
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true })
    window.history.back()
  })
}

/**
 * On mobile an open panel pushes one history entry, so hardware/browser back closes the
 * surface instead of leaving the page (ComposerEmojiPanel precedent). X/Esc/scrim close
 * consumes the entry.
 */
const useSettingsModal = () => {
  // The entry waits for the profile. Signed out, `SettingsTakeover` renders nothing. While
  // auth loads, the intake below clears the hash first, so this push never lands under it.
  const signedIn = useAuthStore((state) => !!state.profile)
  const [isOpen, setIsOpen] = useState(false)
  const ownsHistoryEntryRef = useRef(false)

  useEffect(() => {
    if (!isOpen || !signedIn || !isMobileSurface()) return
    window.history.pushState({ settingsTakeover: true }, '')
    ownsHistoryEntryRef.current = true
    const onPop = () => {
      // Landing back on our own entry means a dialog stacked above us was popped, not us.
      if (window.history.state?.settingsTakeover) return
      ownsHistoryEntryRef.current = false
      setIsOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Guarded so a close that already navigated (doc open, sign-out) is left alone.
      if (ownsHistoryEntryRef.current) {
        ownsHistoryEntryRef.current = false
        void consumeSettingsTakeoverEntry()
      }
    }
  }, [isOpen, signedIn])

  return { isOpen, setIsOpen }
}

/**
 * Which overlay hash a host consumes. Only one mount per page may take `#settings`, or one
 * link opens two takeovers. Home takes `#settings` alone and leaves `#notifications` in place.
 */
type SettingsHashIntake = 'none' | 'settings' | { notifications: () => void }

interface SettingsOpenerOptions {
  /** Defaults to `'none'`. A `notifications` action must be stable, or the intake re-runs. */
  hashIntake?: SettingsHashIntake
  /** Runs on every open, from a click or from the hash. Must be stable. */
  beforeOpen?: () => void
}

/** The one Settings opener for a host: open state, the requested tab, and hash intake. */
export const useSettingsOpener = ({
  hashIntake = 'none',
  beforeOpen
}: SettingsOpenerOptions = {}) => {
  const { isOpen, setIsOpen } = useSettingsModal()
  const [tab, setTab] = useState<TabType | undefined>(undefined)
  const user = useAuthStore((state) => state.profile)
  const settingsMayOpen = useAuthStore(selectSettingsMayOpen)
  const { overlay, settingsTab: hashTab } = useHashOverlay()

  // No argument means a plain button, which must not reopen the tab a hash asked for.
  const open = useCallback(
    (nextTab?: TabType) => {
      beforeOpen?.()
      setTab(nextTab)
      setIsOpen(true)
    },
    [beforeOpen, setIsOpen]
  )

  const notifications = typeof hashIntake === 'object' ? hashIntake.notifications : null
  const takesHash = hashIntake !== 'none'

  // The hash is a one-shot instruction. A layout effect, so the clear lands before the
  // passive push above and not on top of it. While auth loads, Settings opens on its
  // skeleton and keeps the hash; a signed-out reader keeps it, so signing in still lands.
  useLayoutEffect(() => {
    if (!takesHash || !overlay) return
    if (overlay === 'notifications' && !notifications) return
    if (user) clearOverlayHash()
    if (overlay === 'notifications') {
      if (user) notifications?.()
    } else if (settingsMayOpen) open(hashTab ?? undefined)
  }, [takesHash, notifications, overlay, hashTab, user, settingsMayOpen, open])

  const takeover: SettingsTakeoverProps = { open: isOpen, onOpenChange: setIsOpen, defaultTab: tab }
  return { open, takeover }
}
