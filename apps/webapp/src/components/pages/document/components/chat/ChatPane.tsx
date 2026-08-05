import { useChatPaneMode } from '@components/chatroom/hooks/useChatPaneMode'
import { resolveChatPaneHeight } from '@components/chatroom/utils/chatPaneGeometry'
import { useChatStore } from '@stores'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { useEffect, useRef } from 'react'

import ChatContainerMobile from './ChatContainerMobile'

/** Pad header the pane sits below; its height is reserved for the document floor. */
const PAD_HEADER_SELECTOR = '.mobilePadTitleShell'

/** The pane's true bottom edge — carries the safe-area inset regardless of whether
 *  the composer or the emoji panel is the last visible child (see ChatContainerMobile). */
const PANE_BODY_SELECTOR = '[data-chat-pane-body]'

/**
 * Chat as a flex child of the pad shell, sized to a fraction of it. The shell tracks
 * the visual viewport, so the keyboard shrinks both panes and the split survives
 * without any keyboard handling here.
 */
const ChatPane = () => {
  const paneMode = useChatPaneMode()
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const ref = useRef<HTMLElement>(null)

  const isOpen = paneMode !== 'closed' && Boolean(headingId)

  /**
   * Height is written to the DOM, never held in React state. iOS rewrites
   * `--visual-viewport-height` in a burst on every keyboard step, and a state write
   * per step would re-render this whole subtree — `ChatContainerMobile` is not
   * memoized — and thrash Virtuoso's measurement mid-animation.
   */
  useEffect(() => {
    const el = ref.current
    const shell = el?.parentElement
    if (!isOpen || !el || !shell) return

    const apply = () => {
      const header = shell.querySelector<HTMLElement>(PAD_HEADER_SELECTOR)
      // `paddingBottom` resolves `env(safe-area-inset-bottom)` to a real px value
      // (unlike a CSS custom property, which would read back the literal env() text).
      const body = el.querySelector<HTMLElement>(PANE_BODY_SELECTOR)
      const safeAreaInsetBottom = body ? parseFloat(getComputedStyle(body).paddingBottom) || 0 : 0
      el.style.height = `${resolveChatPaneHeight({
        shellHeight: shell.clientHeight,
        reservedHeight: header?.offsetHeight ?? 0,
        safeAreaInsetBottom,
        mode: paneMode
      })}px`
    }

    // `observe` fires an initial callback, so the first height needs no separate read.
    const observer = new ResizeObserver(apply)
    observer.observe(shell)

    return () => observer.disconnect()
  }, [isOpen, paneMode])

  if (!isOpen) return null

  return (
    <section
      ref={ref}
      aria-label="Heading chat"
      className="chatPane bg-base-100 border-base-300 rounded-t-box flex shrink-0 flex-col overflow-hidden border-t"
      // Starts collapsed so the observer's first write animates it open, and so the
      // pane never paints at its content height for a frame.
      style={{
        height: 0,
        transition: prefersReducedMotion() ? undefined : `height ${MOTION_PANEL_MS}ms ease-out`
      }}>
      <ChatContainerMobile />
    </section>
  )
}

export default ChatPane
