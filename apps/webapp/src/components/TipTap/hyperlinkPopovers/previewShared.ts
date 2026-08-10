import { Icons } from '@components/icons/registry'
import {
  createHTMLElement,
  getSpecialUrlInfo,
  type HyperlinkAttributes,
  type SpecialUrlType
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IconType } from 'react-icons'

import { fetchMetadata, type MetadataResponse } from './fetchMetadata'
import { hrefEventHandler } from './hrefEventHandler'
import { describeInternalDocumentLink } from './internalDocumentLink'
import { runInternalDocumentLink } from './internalDocumentLinkActions'
import { safeImageSrc, writeLinkMetadataAttrs } from './linkMarkUtils'
import type { InternalDocumentLink } from './types'

/**
 * The extension ships no icon catalog (bundle size), so the webapp picks the
 * Lucide icon per `type`. `Partial` is deliberate. Domain-catalog types
 * (`meet`, web `github`/`notion`, …) are omitted because the favicon path
 * always wins for `https://` URLs and a static icon would never render.
 */
const TYPE_TO_ICON: Partial<Record<SpecialUrlType, IconType>> = {
  email: Icons.mail,
  phone: Icons.phone,
  'facetime-audio': Icons.phone,
  sms: Icons.chatroom,
  facetime: Icons.video,
  whatsapp: Icons.chatroom,
  telegram: Icons.chatroom,
  discord: Icons.chatroom,
  skype: Icons.chatroom,
  slack: Icons.chatroom,
  twitter: Icons.share,
  facebook: Icons.share,
  instagram: Icons.share,
  linkedin: Icons.share,
  snapchat: Icons.share,
  reddit: Icons.share,
  tiktok: Icons.share,
  contacts: Icons.share,
  zoom: Icons.video,
  teams: Icons.video,
  webex: Icons.video,
  calendar: Icons.calendar,
  reminders: Icons.calendar,
  maps: Icons.mapPin,
  uber: Icons.mapPin,
  lyft: Icons.mapPin,
  music: Icons.music,
  spotify: Icons.music,
  'apple-tv': Icons.tv,
  youtube: Icons.tv,
  netflix: Icons.tv,
  twitch: Icons.tv,
  notes: Icons.fileText,
  shortcuts: Icons.fileText,
  github: Icons.fileText,
  gitlab: Icons.fileText,
  vscode: Icons.fileText,
  notion: Icons.fileText,
  obsidian: Icons.fileText,
  figma: Icons.fileText,
  photos: Icons.image,
  'app-store': Icons.externalLink,
  amazon: Icons.externalLink
}

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

export const renderIconMarkup = (Icon: IconType, size = 20): string =>
  renderToStaticMarkup(createElement(Icon, { size, 'aria-hidden': true }))

// Render a Lucide React icon into the imperative-DOM popover container.
// `aria-hidden` because the metadata title link alongside is the
// screen-reader-readable surface; the icon is decoration.
const createSvgIcon = (Icon: IconType, className = ''): HTMLElement => {
  return createHTMLElement('div', {
    className: `svg-icon-container ${className}`,
    innerHTML: renderIconMarkup(Icon)
  })
}

/**
 * Favicon/special-icon + title-as-link, shared by the desktop popover and the
 * mobile sheet header (same DOM, different CSS).
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
    // Nothing to fetch a favicon from (mailto:, tel:, custom-scheme apps).
    const Icon = TYPE_TO_ICON[specialInfo.type]
    if (Icon) {
      container.prepend(createSvgIcon(Icon, `metadata-icon-special icon-${specialInfo.category}`))
    }
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
 * Lets the caller flush the pending mark-attr write at the right moment in the
 * popover lifecycle — typically inside the `observeDetachment` callback.
 */
export interface RenderHandle {
  flush: () => void
}

/**
 * A failed fetch degrades to href-as-title: the link still works, so visible
 * error styling would be noise. The caller MUST invoke `flush()` only AFTER
 * the popover detaches — see `writeLinkMetadataAttrs` for why.
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
 * Fires once on detachment by any trigger — backdrop tap, Escape, the
 * extension's outside-click listener, a `controller.reposition` swap. The
 * extension exposes no "popover closed" event, hence the MutationObserver.
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

/**
 * Imperative DOM (not React) so it slots into the existing
 * `.hyperlink-preview-popover` without a mount, like `createMetadataContent`.
 */
export const createInternalLinkChip = (link: InternalDocumentLink, editor: Editor): HTMLElement => {
  const { label, sublabel, icon } = describeInternalDocumentLink(link, editor)

  const chip = createHTMLElement('button', {
    className: 'internal-link-chip',
    title: label,
    ariaLabel: label
  })
  const iconEl = createHTMLElement('span', {
    className: 'chip-icon',
    innerHTML: renderIconMarkup(icon, 18)
  })
  const text = createHTMLElement('span', { className: 'chip-text' })
  text.append(
    createHTMLElement('span', { className: 'chip-title', innerText: label }),
    createHTMLElement('span', { className: 'chip-sub', innerText: sublabel })
  )
  chip.append(iconEl, text)
  chip.addEventListener('click', () => runInternalDocumentLink(link))
  return chip
}
