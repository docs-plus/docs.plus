import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { createPopover, getDefaultController, type Popover } from '../floating-popover'
import { openLink } from '../interactions/openLink'
import type { LinkContext } from '../interactions/types'
import { logger } from '../utils/logger'
import {
  createHovercardContent,
  type HovercardBody,
  type HovercardContent,
  type PreloadedImage,
  preloadImage
} from './content'
import { chooseImageShape, keepsHovercardOpen } from './rules'
import type { HovercardData, HovercardOptions, ImageShape } from './types'

const HOVERCARD_KIND = 'hovercard'
// The dwell is also the herd guard: a pointer that only passes over a link sends no request.
const DWELL_MS = 150
const OPEN_AT_MS = 500
// Time to cross the gap between the link and the card (the hover bridge).
const CLOSE_DELAY_MS = 300
// A picture that settles inside this wait opens with the card, so few cards show the empty well.
const IMAGE_WAIT_MS = 300
const GIVE_UP_MS = 4000
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

type Pending = {
  link: HTMLAnchorElement
  href: string
  enteredAt: number
  data?: HovercardData
  dataAt?: number
  picture?: PreloadedImage
  pictureAt?: number
}

type Zone = HTMLAnchorElement | 'card' | null

type Card = {
  popover: Popover
  link: HTMLAnchorElement
  content: HovercardContent
  /** The request a loading card still waits for. */
  awaiting: Pending | null
}

/**
 * Desktop link hovercard. It opens only while no other popover kind is mounted,
 * because `adopt()` destroys the current owner, and it closes only its own card.
 * Every listener lives in `view()`, so `destroy()` also covers an unmount.
 */
export function createHovercardPlugin(linkCtx: LinkContext, options: HovercardOptions): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkHovercard'),
    view: (view) => createHovercardView(view, linkCtx, options)
  })
}

function createHovercardView(
  view: EditorView,
  linkCtx: LinkContext,
  options: HovercardOptions
): { destroy: () => void } {
  const doc = view.dom.ownerDocument
  let zone: Zone = null
  let card: Card | null = null
  let pending: Pending | null = null
  let dwellTimer: ReturnType<typeof setTimeout> | undefined
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let giveUpTimer: ReturnType<typeof setTimeout> | undefined
  let warnedShouldShow = false

  const canHover = (): boolean => doc.defaultView?.matchMedia?.(FINE_POINTER_QUERY).matches ?? false

  const isOtherPopoverOpen = (): boolean => {
    const state = getDefaultController().getState()
    return state.kind === 'mounted' && state.popoverKind !== HOVERCARD_KIND
  }

  const inCard = (target: EventTarget | null): boolean =>
    !!card && target instanceof Node && card.popover.element.contains(target)

  // Two editors share one document, so a link must sit inside this view.
  const linkAt = (target: EventTarget | null): HTMLAnchorElement | null => {
    if (!(target instanceof Element)) return null
    const link = target.closest('a')
    return link && view.dom.contains(link) ? link : null
  }

  // The stored mark href, never `link.href`. No mark (an embed's own anchor) means no card.
  const storedHref = (link: HTMLAnchorElement): string | null => {
    try {
      const node = view.state.doc.nodeAt(view.posAtDOM(link, 0))
      const href = node?.marks.find((m) => m.type === linkCtx.type)?.attrs.href
      return typeof href === 'string' ? href : null
    } catch {
      return null
    }
  }

  // A host callback that throws shows no card, and logs once per editor.
  const hostAllows = (href: string, link: HTMLAnchorElement): boolean => {
    if (!options.shouldShow) return true
    try {
      return options.shouldShow({ href, link })
    } catch (e) {
      if (!warnedShouldShow) logger.error('shouldShow threw; no card shows', e)
      warnedShouldShow = true
      return false
    }
  }

  const dropPending = (): void => {
    clearTimeout(dwellTimer)
    clearTimeout(openTimer)
    pending = null
  }

  const hideCard = (): void => {
    clearTimeout(closeTimer)
    card?.popover.hide()
  }

  // The host's size wins; else the loaded picture's own size.
  const chooseShape = (data: HovercardData, picture?: PreloadedImage): ImageShape => {
    const size =
      data.image?.width && data.image.height
        ? data.image
        : picture?.settled === 'ready'
          ? { width: picture.img.naturalWidth, height: picture.img.naturalHeight }
          : undefined
    return chooseImageShape(options.imageLayout ?? 'cover', data.kind, size)
  }

  // A page with no title shows no picture, so its picture is never loaded.
  const preloadFor = (data: HovercardData): PreloadedImage | undefined =>
    data.title && data.image ? preloadImage(data.image.url) : undefined

  const dataBody = (data: HovercardData, picture?: PreloadedImage): HovercardBody => {
    const { title } = data
    if (!title) return { state: 'empty' }
    return {
      state: 'data',
      data: { ...data, title },
      picture: picture ?? null,
      shape: chooseShape(data, picture)
    }
  }

  const show = (token: Pending, body: HovercardBody): void => {
    const { link, href } = token
    const content = createHovercardContent(href, body, {
      siteIcon: options.siteIcon,
      open: (target, newTab) => {
        hideCard()
        openLink(linkCtx, target, { newTab })
      }
    })
    const popover = createPopover({
      referenceElement: link,
      content: content.element,
      placement: 'bottom-start',
      onHide: () => {
        content.dispose()
        if (card?.popover !== popover) return
        card = null
        clearTimeout(giveUpTimer)
      }
    })
    getDefaultController().adopt(popover, HOVERCARD_KIND, {
      element: popover.element,
      referenceElement: link
    })
    card = { popover, link, content, awaiting: body.state === 'loading' ? token : null }
    popover.show()
  }

  // Swaps the loading body in the same popover. `autoUpdate` re-places the card as it grows.
  const fill = (token: Pending, data: HovercardData | null): void => {
    if (!card || card.awaiting !== token) return
    card.awaiting = null
    clearTimeout(giveUpTimer)
    card.content.setBody(data ? dataBody(data, preloadFor(data)) : { state: 'empty' })
  }

  // `createPopover` adopts at once and would destroy a mounted preview, so check right before it.
  const open = (token: Pending): void => {
    if (pending !== token) return
    pending = null
    if (!token.link.isConnected || isOtherPopoverOpen()) return
    if (token.data) return show(token, dataBody(token.data, token.picture))
    show(token, { state: 'loading' })
    giveUpTimer = setTimeout(() => fill(token, null), token.enteredAt + GIVE_UP_MS - Date.now())
  }

  // Opens at max(enteredAt + 500, min(dataAt + 300, pictureSettledAt)).
  const scheduleOpen = (token: Pending): void => {
    if (pending !== token || token.dataAt === undefined) return
    const pictureAt = !token.picture
      ? token.dataAt
      : token.picture.settled === 'pending'
        ? Infinity
        : (token.pictureAt ?? token.dataAt)
    const openAt = Math.max(
      token.enteredAt + OPEN_AT_MS,
      Math.min(token.dataAt + IMAGE_WAIT_MS, pictureAt)
    )
    clearTimeout(openTimer)
    openTimer = setTimeout(() => open(token), Math.max(0, openAt - Date.now()))
  }

  const onData = (token: Pending, data: HovercardData | null): void => {
    if (card?.awaiting === token) return fill(token, data)
    if (pending !== token) return
    if (!data) {
      pending = null
      return
    }
    token.data = data
    token.dataAt = Date.now()
    const picture = preloadFor(data)
    if (picture) {
      token.picture = picture
      void picture.done.then(() => {
        token.pictureAt = Date.now()
        scheduleOpen(token)
      })
    }
    scheduleOpen(token)
  }

  // Leaving drops the pending open; the request itself runs on, since the host shares it.
  const startPending = (link: HTMLAnchorElement, href: string): void => {
    const token: Pending = { link, href, enteredAt: Date.now() }
    pending = token
    dwellTimer = setTimeout(() => {
      if (pending !== token) return
      if (isOtherPopoverOpen()) return dropPending()
      new Promise<HovercardData | null>((resolve) => resolve(options.fetchMetadata({ href }))).then(
        (data) => onData(token, data),
        () => onData(token, null)
      )
    }, DWELL_MS)
    openTimer = setTimeout(() => open(token), OPEN_AT_MS)
  }

  const enterZone = (next: Zone, buttons: number): void => {
    if (next === zone) return
    zone = next
    dropPending()

    if (card && (next === 'card' || next === card.link)) {
      clearTimeout(closeTimer)
      return
    }
    if (card) {
      clearTimeout(closeTimer)
      closeTimer = setTimeout(hideCard, CLOSE_DELAY_MS)
    }
    if (next === null || next === 'card' || buttons !== 0) return
    if (!canHover() || isOtherPopoverOpen()) return

    const href = storedHref(next)
    // The host's read gate: a refused href gets no request and no card.
    if (!href || !linkCtx.urls.forRead(href).navigable) return
    if (!hostAllows(href, next)) return
    startPending(next, href)
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
    hideCard()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!keepsHovercardOpen(e)) dismiss(e)
  }

  doc.addEventListener('pointerover', onPointerOver)
  doc.addEventListener('pointerout', onPointerOut)
  doc.addEventListener('pointerdown', dismiss, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('compositionstart', dismiss, true)

  return {
    destroy() {
      doc.removeEventListener('pointerover', onPointerOver)
      doc.removeEventListener('pointerout', onPointerOut)
      doc.removeEventListener('pointerdown', dismiss, true)
      doc.removeEventListener('keydown', onKeyDown, true)
      doc.removeEventListener('compositionstart', dismiss, true)
      dropPending()
      clearTimeout(closeTimer)
      clearTimeout(giveUpTimer)
      zone = null
      card?.popover.destroy()
      card = null
    }
  }
}
