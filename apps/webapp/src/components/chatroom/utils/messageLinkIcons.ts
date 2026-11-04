import { padLinkIcon } from '@components/TipTap/padLinkIcon'
import { linkIconFor } from '@docs.plus/extension-hyperlink'

/**
 * Puts the pad's link icon in each link of a posted message. One `padLinkIcon` serves the
 * pad and chat, so an icon URL loads once for both. `linkIconFor` is the pad's own guard,
 * so a throwing resolver leaves the link plain. Safe to run twice: an iconed link is skipped.
 */
export const addMessageLinkIcons = (root: HTMLElement): void => {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (link.querySelector(':scope > .hyperlink-icon')) continue
    const icon = linkIconFor(padLinkIcon, link.getAttribute('href')?.trim() ?? '')
    if (icon) link.prepend(icon)
  }
}
