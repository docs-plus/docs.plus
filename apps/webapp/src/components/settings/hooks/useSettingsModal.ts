import { useEffect, useRef, useState } from 'react'

const TAKEOVER_MQ = '(max-width: 767px)'

/**
 * Sole consumer of the takeover's history entry: pops it (if present) and resolves once the
 * traversal lands — callers that navigate next (sign-out) await this instead of guessing.
 */
export const consumeSettingsTakeoverEntry = (): Promise<void> => {
  if (!window.history.state?.settingsTakeover) return Promise.resolve()
  return new Promise((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true })
    window.history.back()
  })
}

/**
 * Open state for the Settings modal. Below `md` (the mobileTakeover breakpoint) an open
 * panel pushes one history entry so hardware/browser back closes the surface instead of
 * leaving the page (ComposerEmojiPanel precedent); X/Esc/scrim close consumes the entry.
 */
export const useSettingsModal = (takeoverEnabled = true) => {
  const [isOpen, setIsOpen] = useState(false)
  const ownsHistoryEntryRef = useRef(false)

  useEffect(() => {
    if (!isOpen || !takeoverEnabled || !window.matchMedia(TAKEOVER_MQ).matches) return
    window.history.pushState({ settingsTakeover: true }, '')
    ownsHistoryEntryRef.current = true
    const onPop = () => {
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
