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

/**
 * Strips `.hyperlink-icon` elements from clipboard HTML when copying posted chat messages so
 * external apps (mail, notes) receive plain `<a>` links instead of inline 16px icons (#697).
 * Leaves native copy untouched when the selection contains no link icons.
 */
export const stripLinkIconsOnCopy = (
  event: Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>,
  root: HTMLElement
): void => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
  if (!event.clipboardData) return

  const container = document.createElement('div')
  let touchesRoot = false
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i)
    const ancestor = range.commonAncestorContainer
    if (!root.contains(ancestor) && !ancestor.contains(root)) continue

    touchesRoot = true
    const fragment = range.cloneContents()
    const ancestorEl =
      ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as Element) : ancestor.parentElement
    const enclosingAnchor = ancestorEl?.closest('a')
    if (enclosingAnchor && root.contains(enclosingAnchor)) {
      const wrapper = enclosingAnchor.cloneNode(false)
      wrapper.appendChild(fragment)
      container.appendChild(wrapper)
    } else {
      container.appendChild(fragment)
    }
  }
  if (!touchesRoot) return

  const icons = container.querySelectorAll('.hyperlink-icon')
  if (icons.length === 0) return

  for (const icon of icons) icon.remove()
  event.preventDefault()
  event.clipboardData.setData('text/html', container.innerHTML)
  event.clipboardData.setData('text/plain', selection.toString())
}
