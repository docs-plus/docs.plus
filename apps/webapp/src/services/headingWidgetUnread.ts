import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { useChatStore } from '@stores'
import { formatCappedCount } from '@utils/formatCappedCount'
import { resolveUnreadCount } from '@utils/unreadDisplay'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`

/**
 * Write capped unread onto ProseMirror `.ha-chat-btn` widgets (CSS ::before path).
 * Must stay Decoration.widget DOM — attribute writes are ignored by DOMObserver.
 * TOC/header use React UnreadBadge; both share `resolveUnreadCount`.
 */
export function syncHeadingWidgetUnread(): void {
  const source = useChatStore.getState()

  const updateElement = (el: HTMLElement, count: number) => {
    const oldCount = parseInt(el.dataset.unreadCount || '0', 10)
    if (count > 0) {
      if (count !== oldCount) {
        el.dataset.countDir = count > oldCount ? 'up' : 'down'
        el.style.animation = 'none'
        void el.offsetHeight
        el.style.animation = ''
      }
      el.dataset.unreadCount = formatCappedCount(count)
    } else {
      delete el.dataset.unreadCount
      delete el.dataset.countDir
    }
  }

  document
    .querySelectorAll<HTMLElement>(`${headingChatBtnSelector}[data-heading-id]`)
    .forEach((el) => {
      const headingId = el.dataset.headingId
      if (!headingId) return
      updateElement(el, resolveUnreadCount(headingId, source))
    })

  source.channels.forEach((_channel, channelId) => {
    const headingEl = document.querySelector<HTMLElement>(`[data-toc-id="${channelId}"]`)
    if (!headingEl) return
    const el = headingEl.querySelector<HTMLElement>(
      `${headingChatBtnSelector}:not([data-heading-id])`
    )
    if (el) updateElement(el, resolveUnreadCount(channelId, source))
  })
}
