import {
  getDefaultController,
  isSafeHref,
  SAFE_WINDOW_FEATURES
} from '@docs.plus/extension-hyperlink'
import { padSlugOf, shallowPath } from '@utils/filterRoute'
import { isReservedSlug } from '@utils/reservedSlugs'
import Router from 'next/router'

import { classifyInternalDocumentLink } from './internalDocumentLink'
import { runInternalDocumentLink } from './internalDocumentLinkActions'

// The webapp ships its own preview popover (`previewHyperlink` factory wired
// into `Hyperlink.configure`), so the extension's hardened
// `previewHyperlinkPopover` is never on this click path. Reuse the extension's
// exported `SAFE_WINDOW_FEATURES` so both stacks pass `'noopener,noreferrer'`.

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
  // A path with a file extension is a public file, not a pad, so it opens a tab.
  if (!(event?.metaKey || event?.ctrlKey)) {
    try {
      const url = new URL(href, window.location.origin)
      const slug = padSlugOf(url.pathname)
      if (
        url.origin === window.location.origin &&
        slug &&
        !isReservedSlug(slug) &&
        !/\.[a-z0-9]+$/i.test(url.pathname)
      ) {
        // Close the preview popover, as an in-document link does; the route stays in this window.
        getDefaultController().close()
        void Router.push(shallowPath(url))
        return
      }
    } catch {
      // An href that does not parse opens in a new tab, as before.
    }
  }

  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}

export const hrefEventHandler =
  (href: string, isAllowedUri?: (uri: string) => boolean) =>
  (event: MouseEvent): void => {
    event.preventDefault()
    navigateHref(href, isAllowedUri, event)
  }
