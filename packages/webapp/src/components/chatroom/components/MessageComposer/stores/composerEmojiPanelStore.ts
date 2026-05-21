import { useStore } from '@stores'
import { create } from 'zustand'

export type ComposerEmojiPanelMode = 'peek' | 'expanded'

const PEEK_FALLBACK_PX = 300

type PanelHistoryState = { composerEmojiPanel: true }

interface ComposerEmojiPanelState {
  isOpen: boolean
  mode: ComposerEmojiPanelMode
  /** Snapshot of `useStore.keyboardHeight` at `open()` time. Set once per
   *  open so the panel renders at the right height even after `blur()`
   *  resets the live keyboard-height to 0. */
  peekHeightPx: number
  open: () => void
  expand: () => void
  collapse: () => void
  close: () => void
}

export const useComposerEmojiPanelStore = create<ComposerEmojiPanelState>((set, get) => ({
  isOpen: false,
  mode: 'peek',
  peekHeightPx: PEEK_FALLBACK_PX,
  open: () => {
    // Idempotent — guard against double-push of history entries from any
    // accidental second call (e.g., a future deep-link / programmatic opener).
    if (get().isOpen) return
    const live = useStore.getState().keyboardHeight
    set({
      isOpen: true,
      mode: 'peek',
      peekHeightPx: live > 0 ? live : PEEK_FALLBACK_PX
    })
    if (typeof window !== 'undefined') {
      window.history.pushState({ composerEmojiPanel: true } satisfies PanelHistoryState, '')
    }
  },
  expand: () => set({ mode: 'expanded' }),
  collapse: () => set({ mode: 'peek' }),
  close: () => {
    set({ isOpen: false, mode: 'peek' })
    // Pop our entry iff we are still at it; the resulting popstate is a
    // no-op for the MessageComposer listener (isOpen is already false).
    const state = typeof window !== 'undefined' ? window.history.state : null
    if ((state as PanelHistoryState | null)?.composerEmojiPanel) window.history.back()
  }
}))
