import {
  getDefaultController,
  isSafeHref,
  keepsHovercardOpen
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { useEffect, useRef, useState } from 'react'

import { linkDestination } from '../internalDocumentLink'
import { hoverPreviewsOn } from '../padHovercard'
import type { PadLink } from '../types'
import { loadCardView } from './loadCard'
import type { CardView } from './model'

// The extension hovercard's timing (`hovercardPlugin.ts`); the two cards must feel the same.
const DWELL_MS = 150
const OPEN_AT_MS = 500
const CLOSE_DELAY_MS = 300
const GIVE_UP_MS = 4000
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const HYPERLINK_MARK = 'hyperlink'
const EXTENSION_HOVERCARD = 'hovercard'

type OpenCard = { link: HTMLAnchorElement; href: string; view: CardView }

type Pending = {
  link: HTMLAnchorElement
  href: string
  enteredAt: number
  view?: CardView
}

type Zone = HTMLAnchorElement | 'card' | null

/**
 * `strict` also counts the extension's web-link card. Only the open is strict: that card
 * closes 300 ms after the pointer leaves it, before this card opens at 500 ms.
 */
const otherPopoverOpen = (strict: boolean): boolean => {
  const state = getDefaultController().getState()
  return state.kind === 'mounted' && (strict || state.popoverKind !== EXTENSION_HOVERCARD)
}

/**
 * The docs.plus link hovercard's timing and gates. Every listener and timer lives in one
 * effect per editor, so an editor swap or an unmount drops them all and closes the card.
 */
export function usePadLinkHovercard(editor: Editor | null) {
  const [card, setCard] = useState<OpenCard | null>(null)
  const [open, setOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!editor) return
    let zone: Zone = null
    let pending: Pending | null = null
    let shown: Pending | null = null
    let awaiting: Pending | null = null
    let dwellTimer: ReturnType<typeof setTimeout> | undefined
    let openTimer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    const canHover = (): boolean => window.matchMedia?.(FINE_POINTER_QUERY).matches ?? false

    const inCard = (target: EventTarget | null): boolean =>
      !!shown && target instanceof Node && !!cardRef.current?.contains(target)

    // Read late: the store can hold the editor before its view mounts, and reading it then throws.
    const liveView = (): EditorView | null => {
      if (editor.isDestroyed) return null
      try {
        return editor.view.dom ? editor.view : null
      } catch {
        return null
      }
    }

    const linkAt = (target: EventTarget | null): HTMLAnchorElement | null => {
      if (!(target instanceof Element)) return null
      const link = target.closest('a')
      return link && liveView()?.dom.contains(link) ? link : null
    }

    // The stored mark href, never `link.href`. No mark (an embed's own anchor) means no card.
    const storedHref = (link: HTMLAnchorElement): string | null => {
      const view = liveView()
      if (!view) return null
      try {
        const node = view.state.doc.nodeAt(view.posAtDOM(link, 0))
        const href = node?.marks.find((m) => m.type.name === HYPERLINK_MARK)?.attrs.href
        return typeof href === 'string' ? href : null
      } catch {
        return null
      }
    }

    const dropPending = (): void => {
      clearTimeout(dwellTimer)
      clearTimeout(openTimer)
      pending = null
    }

    const hide = (): void => {
      clearTimeout(closeTimer)
      clearTimeout(giveUpTimer)
      shown = null
      awaiting = null
      setOpen(false)
    }
    closeRef.current = () => {
      dropPending()
      zone = null
      hide()
    }

    const show = (token: Pending, cardView: CardView): void => {
      shown = token
      awaiting = cardView.state === 'loading' ? token : null
      setCard({ link: token.link, href: token.href, view: cardView })
      setOpen(true)
    }

    // The card opens at 500 ms: complete when the data is in, else loading until it lands.
    const openCard = (token: Pending): void => {
      if (pending !== token) return
      pending = null
      if (!token.link.isConnected || otherPopoverOpen(true)) return
      if (token.view) return show(token, token.view)
      show(token, { state: 'loading' })
      const wait = token.enteredAt + GIVE_UP_MS - Date.now()
      giveUpTimer = setTimeout(() => fill(token, { state: 'empty' }), Math.max(0, wait))
    }

    const fill = (token: Pending, cardView: CardView): void => {
      if (awaiting !== token) return
      awaiting = null
      clearTimeout(giveUpTimer)
      setCard({ link: token.link, href: token.href, view: cardView })
    }

    // Like the extension: no reply before the open drops the card; after it, the empty line.
    const onView = (token: Pending, cardView: CardView | null): void => {
      if (disposed) return
      if (awaiting === token) return fill(token, cardView ?? { state: 'empty' })
      if (pending !== token) return
      if (cardView) token.view = cardView
      else dropPending()
    }

    const startPending = (link: HTMLAnchorElement, href: string, destination: PadLink): void => {
      const token: Pending = { link, href, enteredAt: Date.now() }
      pending = token
      dwellTimer = setTimeout(() => {
        if (pending !== token || otherPopoverOpen(false)) return
        loadCardView(destination, editor).then(
          (cardView) => onView(token, cardView),
          () => onView(token, null)
        )
      }, DWELL_MS)
      openTimer = setTimeout(() => openCard(token), OPEN_AT_MS)
    }

    const enterZone = (next: Zone, buttons: number): void => {
      if (next === zone) return
      zone = next
      dropPending()

      if (shown && (next === 'card' || next === shown.link)) {
        clearTimeout(closeTimer)
        return
      }
      if (shown) {
        clearTimeout(closeTimer)
        closeTimer = setTimeout(hide, CLOSE_DELAY_MS)
      }
      if (next === null || next === 'card' || buttons !== 0) return
      if (!canHover() || otherPopoverOpen(false) || !hoverPreviewsOn()) return

      const href = storedHref(next)
      if (!href || !isSafeHref(href)) return
      const destination = linkDestination(href)
      if (destination.kind !== 'pad' && destination.kind !== 'here') return
      startPending(next, href, destination)
    }

    const onPointerOver = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return
      enterZone(inCard(e.target) ? 'card' : linkAt(e.target), e.buttons)
    }

    const onPointerOut = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse' && e.relatedTarget === null) enterZone(null, 0)
    }

    // A press, a key or IME input ends the hover: the click preview, create and edit always win.
    const dismiss = (e: Event): void => {
      dropPending()
      if (inCard(e.target)) return
      zone = null
      if (shown) hide()
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!keepsHovercardOpen(e)) dismiss(e)
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('compositionstart', dismiss, true)

    return () => {
      disposed = true
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('compositionstart', dismiss, true)
      dropPending()
      clearTimeout(closeTimer)
      clearTimeout(giveUpTimer)
      closeRef.current = () => {}
      setOpen(false)
      setCard(null)
    }
  }, [editor])

  return { card, open, cardRef, close: () => closeRef.current() }
}
