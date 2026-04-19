import {
  createHTMLElement,
  getSpecialUrlInfo,
  type HyperlinkAttributes
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

import { fetchMetadata, type MetadataResponse } from './fetchMetadata'
import { hrefEventHandler } from './hrefEventHandler'
import * as Icons from './iconList'
import { safeImageSrc, writeLinkMetadataAttrs } from './linkMarkUtils'

/**
 * Context shared by the desktop popover and the mobile sheet. Kept as a
 * plain record so each variant can pull only the fields it needs.
 */
export interface PreviewContext {
  href: string
  editor: Editor
  nodePos: number
  attrs: HyperlinkAttributes
  signal: AbortSignal
}

const createSvgIcon = (iconName: string, className = ''): HTMLElement => {
  const iconFunction = (Icons as Record<string, (props: { size?: number }) => string>)[iconName]
  if (iconFunction && typeof iconFunction === 'function') {
    return createHTMLElement('div', {
      className: `svg-icon-container ${className}`,
      innerHTML: iconFunction({ size: 20 })
    })
  }
  return createHTMLElement('div', {
    className: `svg-icon-container ${className}`,
    innerHTML: `<div class="icon-fallback">${iconName.substring(0, 2).toUpperCase()}</div>`
  })
}

/**
 * Build the inline metadata block: favicon/special-icon + title-as-link.
 * Used by the desktop popover and (with different CSS) inside the mobile
 * sheet header.
 */
export const createMetadataContent = (data: MetadataResponse | null, href: string): HTMLElement => {
  const specialInfo = getSpecialUrlInfo(href)
  const container = createHTMLElement('div', {
    className: `metadata-content ${specialInfo ? 'metadata-content-special' : ''}`
  })

  const titleLink = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: data?.title || href,
    className: 'metadata-title'
  })
  titleLink.addEventListener('click', hrefEventHandler(href))
  container.append(titleLink)

  // Prefer the high-res icon → publisher logo → image thumbnail → special-icon SVG.
  // Each candidate runs through `safeImageSrc` so a hostile data:/javascript:
  // URL from a third-party JSON source can never reach `<img src>`.
  const imageUrl =
    safeImageSrc(data?.icon) ||
    safeImageSrc(data?.publisher?.logo) ||
    safeImageSrc(data?.image?.url) ||
    safeImageSrc(data?.favicon) ||
    safeImageSrc(data?.oembed?.thumbnail)
  if (imageUrl) {
    const img = createHTMLElement('img', {
      src: imageUrl,
      alt: data?.image?.alt || data?.title || '',
      className: 'metadata-image',
      onerror: function (this: HTMLImageElement) {
        this.style.display = 'none'
      }
    })
    container.prepend(img)
  } else if (specialInfo) {
    container.prepend(
      createSvgIcon(specialInfo.icon, `metadata-icon-special icon-${specialInfo.category}`)
    )
  }

  return container
}

const createLoadingSkeleton = (): HTMLElement => {
  const skeleton = createHTMLElement('div', { className: 'metadata-content metadata-loading' })
  const favicon = createHTMLElement('div', { className: 'skeleton-favicon' })
  const bar = createHTMLElement('div', { className: 'skeleton-bar' })
  skeleton.append(favicon, bar)
  return skeleton
}

/**
 * Handle returned by `renderMetadataInto` so callers can flush the
 * pending mark-attr write at the right moment in the popover lifecycle
 * (typically inside the `observeDetachment` callback).
 */
export interface RenderHandle {
  flush: () => void
}

/**
 * Fetch metadata (with cache + abort) and render into `container`:
 * loading skeleton → live content on success, or href-as-title on
 * failure (same graceful degradation as pre-refactor behavior — the
 * link itself is always usable, so a visible error chrome is noise).
 *
 * Returns a `RenderHandle` whose `flush()` writes the freshly-fetched
 * metadata back onto the hyperlink mark (L1 cache for next session).
 * The caller MUST invoke `flush()` only AFTER the popover is detached,
 * because writing mark attrs while the popover is open re-renders the
 * `<a>` reference element and floating-ui hides the popover (see
 * `writeLinkMetadataAttrs` for the full rationale).
 *
 * If the L1 cache already had a title, no fetch happens and `flush()`
 * is a no-op.
 */
export const renderMetadataInto = (container: HTMLElement, ctx: PreviewContext): RenderHandle => {
  const { href, attrs, signal } = ctx

  // L1 cache: persisted mark attrs (Y.js). Skip fetch entirely on hit.
  const existingTitle = typeof attrs?.title === 'string' ? attrs.title : undefined
  const existingImage = typeof attrs?.image === 'string' ? attrs.image : undefined
  if (existingTitle) {
    container.replaceChildren(
      createMetadataContent(
        {
          success: true,
          url: href,
          requested_url: href,
          title: existingTitle,
          image: existingImage ? { url: existingImage } : undefined,
          cached: true,
          fetched_at: new Date(0).toISOString()
        },
        href
      )
    )
    return { flush: () => {} }
  }

  container.replaceChildren(createLoadingSkeleton())

  let pending: MetadataResponse | null = null
  fetchMetadata(href, { signal }).then((data) => {
    if (signal.aborted || !container.isConnected) return
    container.replaceChildren(createMetadataContent(data, href))
    pending = data
  })

  return {
    flush: () => {
      if (pending) writeLinkMetadataAttrs(ctx.editor, ctx.nodePos, ctx.href, pending)
    }
  }
}

/**
 * Watch for the popover element being detached from the DOM (by any
 * trigger — backdrop tap, Escape, extension's outside-click listener,
 * updateCurrentToolbarPosition swap, etc.) and fire `onDetach` exactly
 * once. Used to abort the in-flight metadata fetch.
 *
 * The extension doesn't expose a "popover closed" event, so a
 * MutationObserver on body is the cleanest cross-cutting hook.
 */
export const observeDetachment = (element: HTMLElement, onDetach: () => void): void => {
  const observer = new MutationObserver(() => {
    if (!element.isConnected) {
      onDetach()
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
