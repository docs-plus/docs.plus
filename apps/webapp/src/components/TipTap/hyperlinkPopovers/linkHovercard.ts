import {
  createHTMLElement,
  createPopover,
  getDefaultController,
  normalizeHref,
  type Popover
} from '@docs.plus/extension-hyperlink'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'

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

/** Read-only: built from the shared metadata cache, never from mark attrs (#519). */
const createHovercardContent = (data: MetadataResponse, href: string): HTMLElement => {
  const card = createHTMLElement('div', { className: 'hyperlink-hovercard' })

  const imageSrc = metadataImageUrl(href, data)
  if (imageSrc) {
    const well = createHTMLElement('div', { className: 'hovercard-image' })
    well.append(
      createHTMLElement('img', {
        src: imageSrc,
        alt: '',
        decoding: 'async',
        onerror: () => well.remove()
      })
    )
    card.append(well)
  }

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

  const show = (link: HTMLAnchorElement, href: string, data: MetadataResponse): void => {
    const popover = createPopover({
      referenceElement: link,
      content: createHovercardContent(data, href),
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

  const open = (link: HTMLAnchorElement, href: string): void => {
    void fetchMetadata(href).then((data) => {
      if (!data || zone !== link || card?.link === link || !link.isConnected || editor.isDestroyed)
        return
      if (isOtherPopoverOpen()) return
      show(link, href, data)
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
