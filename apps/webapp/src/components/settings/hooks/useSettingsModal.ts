import { useAuthStore } from '@stores'
import { useEffect, useRef, useState } from 'react'

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
 * Open state for the Settings modal. On mobile an open panel pushes one history entry,
 * so hardware/browser back closes the surface instead of leaving the page
 * (ComposerEmojiPanel precedent). X/Esc/scrim close consumes the entry.
 */
export const useSettingsModal = () => {
  // The entry waits for the profile. Signed out, `SettingsTakeover` renders nothing. While
  // auth loads, a hash host clears its hash first, so this push never lands under it.
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
