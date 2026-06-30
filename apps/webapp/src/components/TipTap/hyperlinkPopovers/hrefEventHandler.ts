import { isSafeHref, SAFE_WINDOW_FEATURES } from '@docs.plus/extension-hyperlink'

import { classifyInternalDocumentLink } from './internalDocumentLink'
import { runInternalDocumentLink } from './internalDocumentLinkActions'

// The webapp ships its own preview popover (`previewHyperlink` factory wired
// into `Hyperlink.configure`), so the extension's hardened
// `previewHyperlinkPopover` is never on this click path. Reuse the extension's
// exported `SAFE_WINDOW_FEATURES` so both stacks pass `'noopener,noreferrer'`.

/**
 * Resolve a hyperlink href and navigate. In-app destinations that belong to
 * the current document (headings, filters, chatrooms, channel messages,
 * revision history, the doc itself) run in place via the shared internal-link
 * resolver — no reload, no new tab. Everything else opens in a new tab.
 *
 * Pure side-effect: no `MouseEvent` required. Use directly from React onClick
 * handlers; use `hrefEventHandler` below as the curried adapter for imperative
 * DOM listeners.
 */
export const navigateHref = (href: string, isAllowedUri?: (uri: string) => boolean): void => {
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

  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}

/**
 * Curried adapter that wraps `navigateHref` for imperative DOM event listeners
 * (the desktop popover's anchor clicks). Calls `event.preventDefault()` so the
 * browser doesn't also follow the href.
 */
export const hrefEventHandler =
  (href: string, isAllowedUri?: (uri: string) => boolean) =>
  (event: MouseEvent): void => {
    event.preventDefault()
    navigateHref(href, isAllowedUri)
  }
