import { Icons } from '@components/icons/registry'
import {
  createHTMLElement,
  getSpecialUrlInfo,
  type SpecialUrlType
} from '@docs.plus/extension-hyperlink'
import { isMacOS } from '@tiptap/core'
import { getSiteIconUrl } from '@utils/link-helpers'
import { lucideSvgString } from '@utils/lucideSvgString'
import type { IconType } from 'react-icons'

import { fetchMetadata } from './fetchMetadata'
import { FILTER_MODE_LABEL_CLASS, FILTER_TERM_PILL_CLASS } from './filterTermPill'
import { hrefEventHandler } from './hrefEventHandler'
import { linkDestination } from './internalDocumentLink'
import { runInternalDocumentLink } from './internalDocumentLinkActions'
import type { InternalDocumentLink, InternalLinkDescriptor } from './types'

/**
 * Preview popover and phone sheet; pad link icons come from `padLinkIcon`. `Partial` is
 * deliberate. For https URLs the route icon wins, so a web entry such as `github` shows its
 * glyph only for app schemes or when no route icon builds.
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

/** The glyph for a link with no http(s) origin (mailto:, tel:, app schemes), if it has one. */
export const specialUrlIcon = (href: string): IconType | undefined => {
  const specialInfo = getSpecialUrlInfo(href)
  return specialInfo ? TYPE_TO_ICON[specialInfo.type] : undefined
}

export interface PreviewContext {
  href: string
  signal: AbortSignal
}

// Decoration only: the title link beside it is what a screen reader reads.
const createSvgIcon = (Icon: IconType): HTMLElement =>
  createHTMLElement('div', { innerHTML: lucideSvgString(Icon, 20) })

/**
 * Our icon route only, so the linked site never sees the reader. A miss hides the img.
 * `null` when the href has no http(s) origin.
 */
export const createSiteIcon = (href: string, className: string): HTMLImageElement | null => {
  const src = getSiteIconUrl(href)
  if (!src) return null
  return createHTMLElement('img', {
    src,
    alt: '',
    className,
    onerror: function (this: HTMLImageElement) {
      this.style.display = 'none'
    }
  })
}

/** C5: the title link of a web page opens a new tab, and Mod-click on the link itself skips the preview. */
const newTabHint = (): string =>
  `Open in a new tab. Tip: ${isMacOS() ? '⌘' : 'Ctrl'}-click the link.`

/**
 * Built before the fetch with the href as its text, so Mod-K can focus the title at once.
 * `renderMetadataInto` then sets the fetched title on this same `<a>`.
 */
const createMetadataContent = (
  href: string
): { container: HTMLElement; titleLink: HTMLElement } => {
  const container = createHTMLElement('div', { className: 'metadata-content' })

  const titleLink = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    textContent: href
  })
  titleLink.dataset.popoverAutofocus = ''
  if (linkDestination(href).kind === 'web') titleLink.title = newTabHint()
  titleLink.addEventListener('click', hrefEventHandler(href))
  container.append(titleLink)

  // A site icon when one loads; with no http(s) origin, the special-icon SVG below.
  const icon = createSiteIcon(href, 'metadata-image')
  const SpecialIcon = icon ? undefined : specialUrlIcon(href)
  if (icon) {
    container.prepend(icon)
  } else if (SpecialIcon) {
    container.prepend(createSvgIcon(SpecialIcon))
  }

  return { container, titleLink }
}

/**
 * Read-only: data comes from the session cache, then REST. Stored mark
 * `title`/`image` are not read, and nothing is written to the document.
 * A failed fetch keeps href-as-title; error styling would be noise.
 */
export const renderMetadataInto = (container: HTMLElement, ctx: PreviewContext): void => {
  const { href, signal } = ctx
  const content = createMetadataContent(href)

  container.replaceChildren(content.container)

  fetchMetadata(href).then((data) => {
    if (signal.aborted || !content.titleLink.isConnected) return
    if (data?.title) content.titleLink.textContent = data.title
  })
}

/**
 * Fires once, when the first of `elements` leaves the page by any trigger — backdrop tap,
 * Escape, the extension's outside-click listener, a `controller.reposition` swap. The
 * extension exposes no "popover closed" event, hence the MutationObserver.
 */
export const observeDetachment = (elements: HTMLElement[], onDetach: () => void): void => {
  const observer = new MutationObserver(() => {
    if (elements.some((element) => !element.isConnected)) {
      onDetach()
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

const chipShell = (
  { label, icon, accessibleName }: InternalLinkDescriptor,
  onClick: () => void
): { chip: HTMLElement; iconEl: HTMLElement; title: HTMLElement } => {
  const chip = createHTMLElement('button', {
    className: 'internal-link-chip',
    ariaLabel: accessibleName
  })
  chip.addEventListener('click', onClick)
  const iconEl = createHTMLElement('span', {
    className: 'chip-icon',
    innerHTML: lucideSvgString(icon, 18)
  })
  const title = createHTMLElement('span', { className: 'chip-title', textContent: label })
  return { chip, iconEl, title }
}

/**
 * Imperative DOM (not React) so it slots into the existing
 * `.hyperlink-preview-popover` without a mount, like `createMetadataContent`.
 * The `/new` chip uses it with its own action.
 */
export const createLinkChip = (
  descriptor: InternalLinkDescriptor,
  onClick: () => void
): HTMLElement => {
  const { chip, iconEl, title } = chipShell(descriptor, onClick)
  // A long heading or chat name is cut with an ellipsis; the tooltip shows it whole.
  title.title = descriptor.label
  const text = createHTMLElement('span', { className: 'chip-text' })
  text.append(
    title,
    createHTMLElement('span', { className: 'chip-sub', textContent: descriptor.sublabel })
  )
  chip.append(iconEl, text)
  return chip
}

/** A filter shows every term (C4): the button stays one control, so only spans go inside it. */
export const createInternalLinkChip = (
  link: InternalDocumentLink,
  descriptor: InternalLinkDescriptor
): HTMLElement => {
  const run = () => runInternalDocumentLink(link)
  if (link.kind !== 'filter') return createLinkChip(descriptor, run)

  const { chip, iconEl, title } = chipShell(descriptor, run)
  chip.classList.add('internal-link-chip--filter')
  const header = createHTMLElement('span', { className: 'chip-header' })
  header.append(iconEl, title)
  if (descriptor.modeLabel) {
    header.append(
      createHTMLElement('span', {
        className: FILTER_MODE_LABEL_CLASS,
        textContent: descriptor.modeLabel
      })
    )
  }
  const terms = createHTMLElement('span', { className: 'chip-terms' })
  terms.append(
    ...link.terms.map((term) =>
      createHTMLElement('span', { className: FILTER_TERM_PILL_CLASS, textContent: term })
    )
  )
  chip.append(header, terms)
  return chip
}
