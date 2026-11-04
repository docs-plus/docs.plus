import { isSafeHref } from '../url-decisions'
import { logger } from '../utils/logger'
import type { LinkIconResolver } from './types'

const warned = new WeakSet<LinkIconResolver>() // one log per resolver, not per link

/**
 * Runs `resolver` for `href` and marks the result as a link icon, or returns `null`.
 * It never throws. It refuses an element that is attached or has text.
 * So a host can call it outside an editor, such as in a list row's layout effect.
 */
export function linkIconFor(resolver: LinkIconResolver, href: string): HTMLElement | null {
  if (typeof href !== 'string' || !href || !isSafeHref(href)) return null // renderHTML blanks it to ''
  const warn = (msg: string, e?: unknown) => {
    if (warned.has(resolver)) return
    warned.add(resolver)
    logger.error(msg, e)
  }
  let icon: unknown
  try {
    icon = resolver({ href })
  } catch (e) {
    warn('linkIcon threw; the link stays plain', e)
    return null
  }
  // parentNode, not isConnected: prosemirror-view renders a paragraph's links before it attaches them
  if (!(icon instanceof HTMLElement) || icon.parentNode || icon.textContent) {
    if (icon != null) warn('linkIcon must return a fresh element with no text')
    return null
  }
  icon.classList.add('hyperlink-icon')
  // An icon that names itself stays spoken; any other is decoration.
  if (icon.getAttribute('aria-label')) icon.setAttribute('role', 'img')
  else icon.setAttribute('aria-hidden', 'true')
  if (icon instanceof HTMLImageElement) icon.draggable = false
  return icon
}
