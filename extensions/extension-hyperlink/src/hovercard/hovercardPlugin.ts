import { hideTooltip } from '@docs.plus/floating-tooltip'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

import { createPopover, getDefaultController, type Popover } from '../floating-popover'
import { openLink } from '../interactions/openLink'
import type { LinkContext } from '../interactions/types'
import { applyTitle } from '../paste-title/applyTitle'
import { copyToClipboard } from '../utils/copyToClipboard'
import { createHTMLElement } from '../utils/createHTMLElement'
import { logger } from '../utils/logger'
import { createBuiltInCard, type PreloadedImage, preloadImage } from './content'
import { keepsHovercardOpen } from './rules'
import type {
  HovercardData,
  HovercardOptions,
  HovercardRenderContext,
  HovercardView
} from './types'

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

/** What a card shows. Only the built-in card has `setBody`, which keeps its link line on a swap. */
type Drawn = HovercardView & {
  setBody?: (ctx: HovercardRenderContext, picture: PreloadedImage | null) => void
}

type Target = { link: HTMLAnchorElement; href: string }

type State = { state: 'loading' | 'empty' } | { state: 'data'; data: HovercardData }

type Pending = Target & {
  enteredAt: number
  /** The accepted answer. The built-in card is drawn from it at the open. */
  data?: HovercardData
  dataAt?: number
  picture?: PreloadedImage
  pictureAt?: number
  /** A host view drawn when the answer is accepted, so it can paint before the open. */
  view?: HovercardView
}

type Zone = HTMLAnchorElement | 'card' | null

type Card = Target & {
  popover: Popover
  /** The engine's `.hyperlink-hovercard` frame. Drawn content fills it. */
  frame: HTMLElement
  drawn: Drawn
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
  let warnedRender = false

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

  const destroyView = (view: HovercardView): void => {
    try {
      view.destroy?.()
    } catch (e) {
      logger.error('A hovercard view destroy threw', e)
    }
  }

  const dropPending = (): void => {
    clearTimeout(dwellTimer)
    clearTimeout(openTimer)
    if (pending?.view) destroyView(pending.view)
    pending = null
  }

  const hideCard = (): void => {
    clearTimeout(closeTimer)
    card?.popover.hide()
  }

  // A stale view must not close a newer card for another link.
  const open = (href: string) => (newTab: boolean) => {
    if (card?.href === href) hideCard()
    openLink(linkCtx, href, { newTab })
  }

  const titleFor = ({ link, href }: Target, state: State): (() => boolean) | undefined => {
    const apply =
      state.state === 'data' ? applyTitle(linkCtx, link, href, state.data.title) : undefined
    if (!apply) return undefined
    return () => {
      const done = apply()
      if (done && card?.href === href) hideCard()
      return done
    }
  }

  const context = (target: Target, state: State): HovercardRenderContext => {
    const { link, href } = target
    const apply = titleFor(target, state)
    return {
      href,
      link,
      editor: linkCtx.editor,
      open: open(href),
      copy: () => copyToClipboard(href),
      ...(apply && { applyTitle: apply }),
      ...state
    }
  }

  // A host view, or null for the built-in card. A throw logs once per editor.
  const renderHost = (ctx: HovercardRenderContext): HovercardView | null => {
    if (!options.render) return null
    try {
      const out = options.render(ctx)
      if (!out) return null
      return 'element' in out ? out : { element: out }
    } catch (e) {
      if (!warnedRender) logger.error('render threw; the built-in card shows', e)
      warnedRender = true
      return null
    }
  }

  const builtIn = (ctx: HovercardRenderContext, picture: PreloadedImage | null): Drawn =>
    createBuiltInCard(ctx, picture, options.siteIcon)

  // Built-in to built-in keeps the link line. Any host view replaces the whole content.
  const swap = (shown: Card, ctx: HovercardRenderContext, picture: PreloadedImage | null): void => {
    const view = renderHost(ctx)
    const old = shown.drawn
    if (!view && old.setBody) return old.setBody(ctx, picture)
    const next = view ?? builtIn(ctx, picture)
    shown.drawn = next
    shown.frame.dataset.swapped = ''
    shown.frame.replaceChildren(next.element)
    // A host may return the same view for two states; it stays in use.
    if (next !== old) destroyView(old)
  }

  // A page with no title shows no picture, so its picture is never loaded.
  const preloadFor = (data: HovercardData): PreloadedImage | undefined =>
    data.title && data.image ? preloadImage(data.image.url) : undefined

  const show = (token: Pending, drawn: Drawn, loading: boolean): void => {
    const { link, href } = token
    const frame = createHTMLElement('div', { className: 'hyperlink-hovercard' })
    frame.append(drawn.element)
    const popover = createPopover({
      referenceElement: link,
      content: frame,
      placement: 'bottom-start',
      onHide: () => {
        // A key press can close the card while the pointer rests on a button with its bubble up.
        hideTooltip()
        if (card !== shown) return
        card = null
        clearTimeout(giveUpTimer)
      },
      // After the exit fade, so a host never empties a card that is still on screen.
      onRemove: () => destroyView(shown.drawn)
    })
    getDefaultController().adopt(popover, HOVERCARD_KIND, {
      element: popover.element,
      referenceElement: link
    })
    const shown: Card = { link, href, popover, frame, drawn, awaiting: loading ? token : null }
    card = shown
    popover.show()
  }

  // Fills the loading card in the same popover. `autoUpdate` re-places the card as it grows.
  const fill = (token: Pending, data: HovercardData | null): void => {
    if (!card || card.awaiting !== token) return
    card.awaiting = null
    clearTimeout(giveUpTimer)
    if (!data) return swap(card, context(token, { state: 'empty' }), null)
    swap(card, context(token, { state: 'data', data }), preloadFor(data) ?? null)
  }

  // `createPopover` adopts at once and would destroy a mounted preview, so check right before it.
  const openPending = (token: Pending): void => {
    if (pending !== token) return
    pending = null
    const { view, data } = token
    token.view = undefined
    if (!token.link.isConnected || isOtherPopoverOpen()) {
      if (view) destroyView(view)
      return
    }
    if (data) {
      const drawn = view ?? builtIn(context(token, { state: 'data', data }), token.picture ?? null)
      return show(token, drawn, false)
    }
    const ctx = context(token, { state: 'loading' })
    show(token, renderHost(ctx) ?? builtIn(ctx, null), true)
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
    openTimer = setTimeout(() => openPending(token), Math.max(0, openAt - Date.now()))
  }

  // Only an accepted answer reaches `render`; a late or dropped one never does.
  const onData = (token: Pending, data: HovercardData | null): void => {
    if (card?.awaiting === token) return fill(token, data)
    if (pending !== token) return
    if (!data) {
      pending = null
      return
    }
    token.data = data
    token.dataAt = Date.now()
    token.view = renderHost(context(token, { state: 'data', data })) ?? undefined
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
      new Promise<HovercardData | null>((resolve) =>
        resolve(options.fetchMetadata({ href, editor: linkCtx.editor }))
      ).then(
        (data) => onData(token, data),
        () => onData(token, null)
      )
    }, DWELL_MS)
    openTimer = setTimeout(() => openPending(token), OPEN_AT_MS)
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
