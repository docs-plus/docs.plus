import { parseHistoryHash } from '@components/pages/history/historyShareUrl'
import {
  hideCurrentToolbar,
  isSafeHref,
  SAFE_WINDOW_FEATURES
} from '@docs.plus/extension-hyperlink'
import { APPLY_FILTER, CHAT_OPEN } from '@services/eventsHub'
import { scrollToHeading } from '@utils/index'
import Router from 'next/router'
import PubSub from 'pubsub-js'

// The webapp ships its own preview popover (`previewHyperlink` factory
// wired into `Hyperlink.configure`), so the extension's hardened
// `previewHyperlinkPopover` is never on this click path. Reuse the
// extension's exported `SAFE_WINDOW_FEATURES` so both stacks pass the
// same `'noopener,noreferrer'` to `window.open`.

/**
 * Resolve a hyperlink href against the current document and navigate.
 * In-app destinations (same-doc headings, filters, chatrooms, channel
 * messages, revision history) are routed through the webapp's navigation
 * layer without a full page load; anything else opens in a new tab.
 *
 * Pure side-effect: no `MouseEvent` required. Use directly from React
 * onClick handlers; use `hrefEventHandler` below as the curried adapter
 * for imperative DOM listeners.
 */
export const navigateHref = (href: string): void => {
  // Defense-in-depth — `parseHTML` strips dangerous schemes on document
  // load and `renderHTML` re-validates on serialize, but a tampered
  // mark could still reach this navigate path via direct `addMark`,
  // collaborative replay, or a downstream HTML transformer. Refuse
  // navigation on `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`
  // before doing anything else.
  if (!isSafeHref(href)) return

  // `isSafeHref` accepts scheme-less hrefs (relative paths, fragments,
  // root-relative URLs) by design — see AGENTS.md "Read-vs-write
  // separation" — so `new URL(href)` can throw here for legacy docs,
  // raw `addMark`, or external setContent paths. Fall through to the
  // new-tab open in that case; in-app routing requires a parseable URL.
  let newUrl: URL
  try {
    newUrl = new URL(href)
  } catch {
    window.open(href, '_blank', SAFE_WINDOW_FEATURES)
    return
  }
  const slugs = location.pathname.split('/').slice(1)

  const headingId = newUrl.searchParams.get('id')
  const isSameDoc = newUrl.pathname.startsWith(`/${slugs[0]}`)
  const newUrlSlugs = newUrl.pathname.split('/').slice(1)
  const chatroomId = newUrl.searchParams.get('chatroom')
  const act = newUrl.searchParams.get('act')
  const messageId = newUrl.searchParams.get('m_id')
  const channelId = newUrl.searchParams.get('c_id')

  if (isSameDoc) {
    // Revision history deep link (#history / #history?version=) — update URL
    // only; the layout reacts to the hash change and mounts the history view.
    if (parseHistoryHash(newUrl.hash).isHistory) {
      hideCurrentToolbar()
      const target = `${newUrl.pathname}${newUrl.search}${newUrl.hash}`
      void Router.push(target, undefined, { shallow: true })
      return
    }

    // More than one slug past the doc name means a filter (e.g. /doc/slug1/slug2).
    if (newUrlSlugs.length > 1) {
      hideCurrentToolbar()
      PubSub.publish(APPLY_FILTER, { slugs: newUrlSlugs.slice(1), href })
      return
    }

    if (chatroomId) {
      PubSub.publish(CHAT_OPEN, { headingId: chatroomId, scroll2Heading: true })
      return
    }

    if (headingId) {
      scrollToHeading(headingId)
      return
    }

    if (act === 'ch' && messageId && channelId) {
      hideCurrentToolbar()
      PubSub.publish(CHAT_OPEN, {
        headingId: channelId,
        scroll2Heading: true,
        fetchMsgsFromId: messageId
      })
      return
    }
  }

  window.open(href, '_blank', SAFE_WINDOW_FEATURES)
}

/**
 * Curried adapter that wraps `navigateHref` for imperative DOM event
 * listeners (the desktop popover's anchor clicks). Calls
 * `event.preventDefault()` so the browser doesn't also follow the href.
 */
export const hrefEventHandler =
  (href: string) =>
  (event: MouseEvent): void => {
    event.preventDefault()
    navigateHref(href)
  }
