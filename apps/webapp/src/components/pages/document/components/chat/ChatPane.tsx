import { useChatPaneGrabber } from '@components/chatroom/hooks/useChatPaneGrabber'
import { useChatPaneHistory } from '@components/chatroom/hooks/useChatPaneHistory'
import { useChatPaneMode } from '@components/chatroom/hooks/useChatPaneMode'
import {
  readChatPaneShell,
  resolveChatPaneHeight
} from '@components/chatroom/utils/chatPaneGeometry'
import { useChatStore } from '@stores'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { useEffect, useRef } from 'react'

import ChatContainerMobile from './ChatContainerMobile'

const ChatPaneGrabber = () => {
  const storedMode = useChatStore((state) => state.chatRoom.paneMode)
  const grabber = useChatPaneGrabber(storedMode === 'half' ? 'half' : 'expanded')

  if (storedMode === 'closed') return null

  return (
    <div
      role="slider"
      tabIndex={0}
      data-chat-pane-grabber
      aria-label="Resize chat"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={storedMode === 'expanded' ? 100 : 50}
      aria-valuetext={storedMode === 'expanded' ? 'Expanded' : 'Half'}
      onPointerDown={grabber.onPointerDown}
      onPointerMove={grabber.onPointerMove}
      onPointerUp={grabber.onPointerUp}
      onPointerCancel={grabber.onPointerUp}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'Home') {
          event.preventDefault()
          useChatStore.getState().setPaneMode('expanded')
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'End') {
          event.preventDefault()
          useChatStore.getState().setPaneMode('half')
        }
      }}
      className="focus-visible:ring-primary/30 flex h-5 w-full shrink-0 cursor-grab touch-none items-center justify-center focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing">
      <span className="bg-base-300 h-1 w-[30px] rounded-full" aria-hidden />
    </div>
  )
}

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
  useChatPaneHistory(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => {
      ref.current?.querySelector<HTMLElement>('[data-chat-pane-grabber]')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  /**
   * Height is written to the DOM, never held in React state. iOS rewrites
   * `--visual-viewport-height` in a burst on every keyboard step. A state write per
   * step would re-render this whole subtree, because `ChatContainerMobile` is not
   * memoized, and would thrash Virtuoso's measurement mid-animation.
   */
  useEffect(() => {
    const el = ref.current
    const shell = el?.parentElement
    if (!isOpen || !el || !shell) return

    const apply = () => {
      if (el.dataset.chatPaneDragging === 'true') return
      const measure = readChatPaneShell(el)
      if (!measure) return
      el.style.height = `${resolveChatPaneHeight({ ...measure, mode: paneMode })}px`
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
      <ChatPaneGrabber />
      <ChatContainerMobile />
    </section>
  )
}

export default ChatPane
