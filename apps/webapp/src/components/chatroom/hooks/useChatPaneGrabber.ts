import {
  CHAT_PANE_SELECTOR,
  readChatPaneShell,
  resolveChatPaneHeight,
  snapChatPaneMode
} from '@components/chatroom/utils/chatPaneGeometry'
import { useChatStore } from '@stores'
import type { ChatPaneMode } from '@types'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useRef } from 'react'

const TAP_PX = 8

const readBounds = (pane: HTMLElement) => {
  const measure = readChatPaneShell(pane)
  if (!measure) return null
  return {
    half: resolveChatPaneHeight({ ...measure, mode: 'half' }),
    expanded: resolveChatPaneHeight({ ...measure, mode: 'expanded' })
  }
}

const settleHeight = (pane: HTMLElement) => {
  pane.style.transition = prefersReducedMotion() ? '' : `height ${MOTION_PANEL_MS}ms ease-out`
  delete pane.dataset.chatPaneDragging
}

/**
 * Sheet-like drag on the pane grabber. Writes height to the DOM during the
 * gesture; release settles to half, expanded, or closed.
 */
export function useChatPaneGrabber(storedMode: Exclude<ChatPaneMode, 'closed'>) {
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const pane = event.currentTarget.closest<HTMLElement>(CHAT_PANE_SELECTOR)
    if (!pane) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pane.dataset.chatPaneDragging = 'true'
    pane.style.transition = 'none'
    drag.current = {
      startY: event.clientY,
      startHeight: pane.getBoundingClientRect().height,
      moved: false
    }
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const session = drag.current
    const pane = event.currentTarget.closest<HTMLElement>(CHAT_PANE_SELECTOR)
    if (!session || !pane) return
    const bounds = readBounds(pane)
    if (!bounds) return
    const dy = session.startY - event.clientY
    if (Math.abs(dy) >= TAP_PX) session.moved = true
    pane.style.height = `${Math.min(Math.max(session.startHeight + dy, 0), bounds.expanded)}px`
  }, [])

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const session = drag.current
      drag.current = null
      const pane = event.currentTarget.closest<HTMLElement>(CHAT_PANE_SELECTOR)
      if (!session || !pane) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const bounds = readBounds(pane)
      if (!bounds) {
        settleHeight(pane)
        return
      }

      if (!session.moved) {
        settleHeight(pane)
        useChatStore.getState().setPaneMode(storedMode === 'expanded' ? 'half' : 'expanded')
        return
      }

      const next = snapChatPaneMode({
        height: pane.getBoundingClientRect().height,
        halfHeight: bounds.half,
        expandedHeight: bounds.expanded
      })
      settleHeight(pane)
      if (next === 'closed') useChatStore.getState().destroyChatRoom()
      else useChatStore.getState().setPaneMode(next)
    },
    [storedMode]
  )

  return { onPointerDown, onPointerMove, onPointerUp }
}
