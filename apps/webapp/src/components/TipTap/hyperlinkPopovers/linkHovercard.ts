import {
  createHTMLElement,
  createPopover,
  getDefaultController,
  normalizeHref,
  type Popover
} from '@docs.plus/extension-hyperlink'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'

import { fetchMetadata, metadataImageUrl, type MetadataResponse } from './fetchMetadata'
import { hrefEventHandler } from './hrefEventHandler'
import { classifyInternalDocumentLink } from './internalDocumentLink'
import { hostnameOf } from './linkMarkUtils'
import { createSiteIcon } from './previewShared'

const HOVERCARD_KIND = 'link-hovercard'
// The dwell is also the herd guard: a pointer that only passes over a link sends no request.
const OPEN_DELAY_MS = 400
// Time to cross the gap between the link and the card (the hover bridge).
const CLOSE_DELAY_MS = 300
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
// An image that settles inside this wait opens with the card, so most cards never show the
// placeholder well, and a failed image never shows one at all.
const IMAGE_WAIT_MS = 300

type PreloadedImage = { img: HTMLImageElement; settled: 'ready' | 'failed' | 'pending' }

const preloadImage = async (src: string): Promise<PreloadedImage> => {
  const image: PreloadedImage = {
    img: createHTMLElement('img', { src, alt: '', decoding: 'async' }),
    settled: 'pending'
  }
  const decoded = image.img.decode().then(
    () => void (image.settled = 'ready'),
    () => void (image.settled = 'failed')
  )
  await Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, IMAGE_WAIT_MS))])
  return image
}

// The well folds away instead of vanishing, so the text under it slides up, not jumps.
const collapseWell = (well: HTMLElement): void => {
  if (prefersReducedMotion() || !well.isConnected) {
    well.remove()
    return
  }
  well.style.height = `${well.offsetHeight}px`
  void well.offsetHeight
  well.dataset.state = 'failed'
  well.style.height = '0px'
  const done = (): void => well.remove()
  well.addEventListener('transitionend', (e) => e.target === well && done())
  setTimeout(done, MOTION_PANEL_MS + 50)
}

const createImageWell = ({ img, settled }: PreloadedImage): HTMLElement | null => {
  if (settled === 'failed') return null
  const well = createHTMLElement('div', { className: 'hovercard-image' })
  well.dataset.state = settled === 'ready' ? 'ready' : 'loading'
  well.append(img)
  if (settled === 'pending') {
    const onLoad = (): void => void (well.dataset.state = 'ready')
    img.addEventListener('load', onLoad, { once: true })
    img.addEventListener('error', () => collapseWell(well), { once: true })
    // The image can settle between the end of the wait and these listeners.
    if (img.complete) {
      if (img.naturalWidth > 0) onLoad()
      else collapseWell(well)
    }
  }
  return well
}

/** Read-only: built from the shared metadata cache, never from mark attrs (#519). */
const createHovercardContent = (
  data: MetadataResponse,
  href: string,
  image: PreloadedImage | null
): HTMLElement => {
  const card = createHTMLElement('div', { className: 'hyperlink-hovercard' })

  const well = image && createImageWell(image)
  if (well) card.append(well)

  const body = createHTMLElement('div', { className: 'flex flex-col gap-1 p-3' })
  const site = createHTMLElement('div', {
    className: 'text-meta text-base-content/70 flex min-w-0 items-center gap-2'
  })
  const icon = createSiteIcon(href, 'size-4 shrink-0 rounded-full')
  if (icon) site.append(icon)
  site.append(
    createHTMLElement('span', { className: 'truncate', innerText: hostnameOf(normalizeHref(href)) })
  )

  const title = createHTMLElement('a', {
    href,
    target: '_blank',
    rel: 'noreferrer',
    innerText: data.title || href,
    className: 'text-base-content line-clamp-2 text-sm font-semibold break-words hover:underline'
  })
  title.addEventListener('click', hrefEventHandler(href))
  body.append(site, title)

  if (data.description) {
    body.append(
      createHTMLElement('p', {
        className: 'text-meta text-base-content/70 line-clamp-3',
        innerText: data.description
      })
    )
  }

  card.append(body)
  return card
}

/**
 * Desktop pad only (#242). One state, `zone`, says where the pointer is: a link, the card,
 * or nowhere. The card opens after a dwell, and only while no other hyperlink popover is
 * mounted, because `adopt()` destroys the current owner. It closes only its own popover.
 */
export function attachLinkHovercard(editor: Editor): () => void {
  let zone: HTMLAnchorElement | 'card' | null = null
  let card: { popover: Popover; link: HTMLAnchorElement } | null = null
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  const canHover = (): boolean =>
    !useStore.getState().settings.editor.isMobile && window.matchMedia(FINE_POINTER_QUERY).matches

  const linkAt = (target: EventTarget | null): HTMLAnchorElement | null => {
    if (editor.isDestroyed || !(target instanceof Element)) return null
    const link = target.closest('a')
    return link && editor.view.dom.contains(link) ? link : null
  }

  // The stored mark href, never `link.href`. No mark (an embed's own anchor) means no card.
  const storedHref = (link: HTMLAnchorElement): string | null => {
    try {
      const node = editor.state.doc.nodeAt(editor.view.posAtDOM(link, 0))
      const href = node?.marks.find((m) => m.type.name === 'hyperlink')?.attrs.href
      return typeof href === 'string' ? href : null
    } catch {
      return null
    }
  }

  const isOtherPopoverOpen = (): boolean => {
    const state = getDefaultController().getState()
    return state.kind === 'mounted' && state.popoverKind !== HOVERCARD_KIND
  }

  const hideCard = (): void => {
    clearTimeout(closeTimer)
    card?.popover.hide()
  }

  const show = (
    link: HTMLAnchorElement,
    href: string,
    data: MetadataResponse,
    image: PreloadedImage | null
  ): void => {
    const popover = createPopover({
      referenceElement: link,
      content: createHovercardContent(data, href, image),
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

  // Asked again after each wait: the pointer may have left, or another popover opened.
  const stillWanted = (link: HTMLAnchorElement): boolean =>
    zone === link &&
    card?.link !== link &&
    link.isConnected &&
    !editor.isDestroyed &&
    !isOtherPopoverOpen()

  const open = (link: HTMLAnchorElement, href: string): void => {
    void fetchMetadata(href).then(async (data) => {
      if (!data || !stillWanted(link)) return
      const src = metadataImageUrl(href, data)
      const image = src ? await preloadImage(src) : null
      if (stillWanted(link)) show(link, href, data, image)
    })
  }

  const enterZone = (next: typeof zone, buttons: number): void => {
    if (next === zone) return
    zone = next
    clearTimeout(openTimer)

    if (card && (next === 'card' || next === card.link)) {
      clearTimeout(closeTimer)
      return
    }
    if (card) {
      clearTimeout(closeTimer)
      closeTimer = setTimeout(hideCard, CLOSE_DELAY_MS)
    }
    if (!(next instanceof HTMLAnchorElement) || buttons !== 0 || !canHover()) return

    const href = storedHref(next)
    if (!href || classifyInternalDocumentLink(href, window.location.pathname)) return
    openTimer = setTimeout(() => {
      if (!isOtherPopoverOpen()) open(next, href)
    }, OPEN_DELAY_MS)
  }

  const onPointerOver = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return
    const inCard = card && e.target instanceof Node && card.popover.element.contains(e.target)
    enterZone(inCard ? 'card' : linkAt(e.target), e.buttons)
  }

  const onPointerOut = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.relatedTarget === null) enterZone(null, 0)
  }

  // A press or a key ends the hover: the click preview, create and edit always win.
  const cancel = (e: Event): void => {
    clearTimeout(openTimer)
    const inCard = card && e.target instanceof Node && card.popover.element.contains(e.target)
    if (inCard) return
    zone = null
    hideCard()
  }

  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('pointerdown', cancel, true)
  document.addEventListener('keydown', cancel, true)

  return () => {
    document.removeEventListener('pointerover', onPointerOver)
    document.removeEventListener('pointerout', onPointerOut)
    document.removeEventListener('pointerdown', cancel, true)
    document.removeEventListener('keydown', cancel, true)
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    // A fetch still in flight checks `zone`, so it can no longer build a card.
    zone = null
    card?.popover.destroy()
  }
}
