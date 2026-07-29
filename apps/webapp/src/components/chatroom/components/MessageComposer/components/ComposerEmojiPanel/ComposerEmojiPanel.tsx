import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import { useChatStore } from '@stores'
import { PANEL_TWEEN } from '@utils/motion'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import { useComposerEmojiPanelStore } from '../../stores/composerEmojiPanelStore'

const EXPANDED_MAX_PX = 480
const EXPANDED_RATIO = 0.7
const HANDLE_HEIGHT_PX = 20

const DRAG_THRESHOLD_SNAP_PX = 30
const DRAG_THRESHOLD_CLOSE_PX = 80

/**
 * Measures the column the panel lives in, not the window. On mobile that column is
 * the chat pane, which is a fraction of the shell — sizing against `innerHeight`
 * overshoots it and leaves the pane's header and composer no room on small phones.
 * Observes only while open, since iOS fires resize heavily during keyboard cycles.
 */
function useHostHeight(enabled: boolean, ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const host = ref.current?.parentElement
    if (!enabled || !host) return

    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.round(entry.contentRect.height))
    })
    observer.observe(host)

    return () => observer.disconnect()
  }, [enabled, ref])

  return height
}

export const ComposerEmojiPanel = () => {
  const isOpen = useComposerEmojiPanelStore((s) => s.isOpen)
  const mode = useComposerEmojiPanelStore((s) => s.mode)
  const peekHeightPx = useComposerEmojiPanelStore((s) => s.peekHeightPx)
  const panelRef = useRef<HTMLDivElement>(null)
  const hostHeight = useHostHeight(isOpen, panelRef)

  // Before the first measurement the host height is 0; fall back to the cap so the
  // panel never opens at zero and then jumps.
  const expandedHeight = hostHeight
    ? Math.min(Math.round(hostHeight * EXPANDED_RATIO), EXPANDED_MAX_PX)
    : EXPANDED_MAX_PX
  // Peek is a snapshot of the keyboard's height, which can exceed the pane it now
  // lives in, so it is capped by the same ceiling.
  const targetHeight = Math.min(mode === 'expanded' ? expandedHeight : peekHeightPx, expandedHeight)

  const handlePanEnd = (_: PointerEvent, info: PanInfo) => {
    const dy = info.offset.y
    const { expand, collapse, close } = useComposerEmojiPanelStore.getState()
    switch (mode) {
      case 'peek':
        if (dy < -DRAG_THRESHOLD_SNAP_PX) expand()
        else if (dy > DRAG_THRESHOLD_CLOSE_PX) close()
        return
      case 'expanded':
        if (dy > DRAG_THRESHOLD_SNAP_PX) collapse()
        return
      default: {
        const _exhaustive: never = mode
        return _exhaustive
      }
    }
  }

  const handleHandleClick = () => {
    const state = useComposerEmojiPanelStore.getState()
    if (state.mode === 'peek') state.expand()
    else state.collapse()
  }

  const handleSelect = useCallback((native: string) => {
    const editor = useChatStore.getState().chatRoom.editorInstance
    editor?.chain().insertContent(native).run()
    const { mode: m, collapse } = useComposerEmojiPanelStore.getState()
    if (m === 'expanded') collapse()
  }, [])

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          ref={panelRef}
          key="composer-emoji-panel"
          role="dialog"
          aria-label="Emoji picker"
          aria-modal="false"
          className="bg-base-100 border-base-300 border-t"
          initial={{ height: 0 }}
          animate={{ height: targetHeight }}
          exit={{ height: 0 }}
          transition={PANEL_TWEEN}
          style={{ overflow: 'hidden' }}>
          {/* Fixed inner content keeps emoji-mart's grid stable across the
              outer height tween; only the clipped portion changes per frame. */}
          <div className="flex flex-col" style={{ height: expandedHeight }}>
            <motion.div
              className="flex w-full shrink-0 items-center justify-center"
              onPanEnd={handlePanEnd}
              onClick={handleHandleClick}
              role="button"
              tabIndex={-1}
              aria-label="Resize emoji panel"
              style={{ height: HANDLE_HEIGHT_PX, touchAction: 'none', cursor: 'grab' }}>
              <span className="bg-base-300 h-1 w-[30px] rounded-full" />
            </motion.div>
            <div
              className="min-h-0 flex-1"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <EmojiPanel variant="mobile" onSelect={handleSelect}>
                <EmojiPanel.Selector />
              </EmojiPanel>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

ComposerEmojiPanel.displayName = 'ComposerEmojiPanel'
