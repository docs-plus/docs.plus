import {
  getDefaultController,
  type HyperlinkOptions,
  isSafeHref,
  SAFE_WINDOW_FEATURES
} from '@docs.plus/extension-hyperlink'
import { padUrl } from '@services/padUrl'
import type { PadFacets } from '@types'
import { isReservedSlug } from '@utils/reservedSlugs'
import Router from 'next/router'

import { classifyInternalDocumentLink } from './internalDocumentLink'
import { runInternalDocumentLink } from './internalDocumentLinkActions'

// The webapp ships its own preview popover (`previewHyperlink` factory wired
// into `Hyperlink.configure`), so the extension's hardened
// `previewHyperlinkPopover` is never on this click path. Reuse the extension's
// exported `SAFE_WINDOW_FEATURES` so both stacks pass `'noopener,noreferrer'`.

/** The address of a same-origin pad, or `null`. A path with a file extension is a public file. */
const anotherPad = (href: string): PadFacets | null => {
  const pad = padUrl.read(href)
  if (!pad?.sameOrigin || !pad.slug || isReservedSlug(pad.slug)) return null
  return /\.[a-z0-9]+$/i.test(new URL(href, window.location.origin).pathname) ? null : pad
}

export const isAnotherPad = (href: string): boolean => anotherPad(href) !== null

/**
 * Destinations inside the current document run in place. A same-origin link to
 * another pad routes in place with `Router.push`, unless Mod is held (#359).
 * Everything else opens in a new tab. The optional event fits React and DOM clicks.
 */
export const navigateHref = (
  href: string,
  isAllowedUri?: (uri: string) => boolean,
  event?: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>
): void => {
  // Defense-in-depth — `parseHTML`/`renderHTML` already strip dangerous
  // schemes, but a tampered mark could still reach this path via direct
  // `addMark`, collaborative replay, or a downstream transformer. Refuse
  // `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` before anything.
  if (isAllowedUri ? !isAllowedUri(href) : !isSafeHref(href)) return

  const link = classifyInternalDocumentLink(href, window.location.pathname)
  if (link) {
    runInternalDocumentLink(link)
    return
  }

  // Another pad: route like a Documents row Open, so the app keeps one window.
  const pad = event?.metaKey || event?.ctrlKey ? null : anotherPad(href)
  if (pad) {
    // Close the preview popover, as an in-document link does; the route stays in this window.
    getDefaultController().close()
    void Router.push(pad.path)
    return
  }

  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}

export const hrefEventHandler =
  (href: string, isAllowedUri?: (uri: string) => boolean) =>
  (event: MouseEvent): void => {
    event.preventDefault()
    navigateHref(href, isAllowedUri, event)
  }

/**
 * Every extension link open (#242). `newTab` is true when the user asked for a new tab (Mod or
 * the middle button). A plain open routes like `navigateHref`.
 */
export const padNavigate: NonNullable<HyperlinkOptions['navigate']> = (href, { newTab }) => {
  if (!newTab) {
    navigateHref(href)
    return
  }
  if (isSafeHref(href)) window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}
