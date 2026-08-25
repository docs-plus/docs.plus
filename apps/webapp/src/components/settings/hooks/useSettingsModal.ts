import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'
import { useEffect, useRef, useState } from 'react'

// The store flag is unset outside the document shell, so fall back to the same
// user-agent test the server runs. A narrow window is not the mobile shell.
const isMobileSurface = (): boolean =>
  useStore.getState().settings.editor.isMobile ??
  Boolean(new MobileDetect(window.navigator.userAgent).mobile())

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
export const useSettingsModal = (takeoverEnabled = true) => {
  const [isOpen, setIsOpen] = useState(false)
  const ownsHistoryEntryRef = useRef(false)

  useEffect(() => {
    if (!isOpen || !takeoverEnabled || !isMobileSurface()) return
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
  }, [isOpen, takeoverEnabled])

  return { isOpen, setIsOpen }
}
