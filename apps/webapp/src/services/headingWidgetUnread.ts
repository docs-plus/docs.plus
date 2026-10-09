import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { useChatStore } from '@stores'
import { formatCappedCount } from '@utils/formatCappedCount'
import { resolveHeadingUnreadCount } from '@utils/unreadDisplay'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`

/**
 * Write capped unread onto ProseMirror `.ha-chat-btn` widgets (CSS ::before path). Must
 * stay Decoration.widget DOM, because attribute writes are ignored by DOMObserver.
 * TOC/header use React UnreadBadge. The TOC shares `resolveHeadingUnreadCount` with these widgets.
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
      updateElement(el, resolveHeadingUnreadCount(headingId, source))
    })
}
