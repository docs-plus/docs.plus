import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { createPopover, getDefaultController, type Popover } from '../floating-popover'
import { openLink } from '../interactions/openLink'
import type { LinkContext } from '../interactions/types'
import { logger } from '../utils/logger'
import { createHovercardContent, type PreloadedImage, preloadImage } from './content'
import { chooseImageShape, keepsHovercardOpen } from './rules'
import type { HovercardData, HovercardOptions } from './types'

const HOVERCARD_KIND = 'hovercard'
// The dwell is also the herd guard: a pointer that only passes over a link sends no request.
const DWELL_MS = 150
const OPEN_AT_MS = 500
// Time to cross the gap between the link and the card (the hover bridge).
const CLOSE_DELAY_MS = 300
// A picture that settles inside this wait opens with the card, so few cards show the empty well.
const IMAGE_WAIT_MS = 300
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
  let card: { popover: Popover; link: HTMLAnchorElement } | null = null
  let pending: Pending | null = null
  let dwellTimer: ReturnType<typeof setTimeout> | undefined
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let destroyed = false
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

  const chooseShape = (data: HovercardData, picture?: PreloadedImage): 'cover' | 'thumb' => {
    const layout = options.imageLayout ?? 'cover'
    const size = data.image
    if (size?.width && size.height) return chooseImageShape(layout, size)
    if (picture?.settled === 'ready') {
      const { naturalWidth: width, naturalHeight: height } = picture.img
      return chooseImageShape(layout, { width, height })
    }
    return 'cover'
  }

  const show = ({ link, href, data, picture }: Pending & { data: HovercardData }): void => {
    const shape = chooseShape(data, picture)
    const content = createHovercardContent(data, href, picture ?? null, shape, {
      siteIcon: options.siteIcon,
      open: (target, newTab) => {
        hideCard()
        openLink(linkCtx, target, { newTab })
      }
    })
    const popover = createPopover({
      referenceElement: link,
      content,
      placement: 'bottom-start',
      onHide: () => {
        if (card?.popover === popover) card = null
      }
    })
    getDefaultController().adopt(popover, HOVERCARD_KIND, {
      element: popover.element,
      referenceElement: link
    })
    card = { popover, link }
    popover.show()
  }

  // `createPopover` adopts at once and would destroy a mounted preview, so check right before it.
  const open = (token: Pending): void => {
    if (pending !== token || destroyed || !token.data) return
    pending = null
    if (!token.link.isConnected || isOtherPopoverOpen()) return
    show({ ...token, data: token.data })
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
    if (pending !== token || destroyed) return
    if (!data) {
      pending = null
      return
    }
    token.data = data
    token.dataAt = Date.now()
    const src = data.image?.url
    if (src) {
      const picture = preloadImage(src)
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
      if (pending !== token || isOtherPopoverOpen()) return
      new Promise<HovercardData | null>((resolve) => resolve(options.fetchMetadata({ href }))).then(
        (data) => onData(token, data),
        () => onData(token, null)
      )
    }, DWELL_MS)
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
    const altGraph = e.getModifierState?.('AltGraph') ?? false
    if (!keepsHovercardOpen({ ...pickKeyFields(e), altGraph })) dismiss(e)
  }

  doc.addEventListener('pointerover', onPointerOver)
  doc.addEventListener('pointerout', onPointerOut)
  doc.addEventListener('pointerdown', dismiss, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('compositionstart', dismiss, true)

  return {
    destroy() {
      destroyed = true
      doc.removeEventListener('pointerover', onPointerOver)
      doc.removeEventListener('pointerout', onPointerOut)
      doc.removeEventListener('pointerdown', dismiss, true)
      doc.removeEventListener('keydown', onKeyDown, true)
      doc.removeEventListener('compositionstart', dismiss, true)
      dropPending()
      clearTimeout(closeTimer)
      zone = null
      card?.popover.destroy()
      card = null
    }
  }
}

// Spread does not copy a KeyboardEvent's getters, so pick the fields the rule reads.
const pickKeyFields = (e: KeyboardEvent) => ({
  key: e.key,
  metaKey: e.metaKey,
  ctrlKey: e.ctrlKey,
  altKey: e.altKey,
  shiftKey: e.shiftKey,
  isComposing: e.isComposing
})
