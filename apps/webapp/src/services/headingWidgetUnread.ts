import { syncHeadingWrapperA11y } from '@components/TipTap/extensions/HeadingActions/plugins/headingWidgetA11y'
import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { useChatStore } from '@stores'
import { formatCappedCount } from '@utils/formatCappedCount'
import { resolveHeadingUnreadCount } from '@utils/unreadDisplay'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`

export const formatHeadingChatAriaLabel = (count: number): string =>
  count > 0 ? `${formatCappedCount(count)} unread — open chat` : 'Open chat'

/**
 * Write capped unread onto ProseMirror `.ha-chat-btn` widgets (CSS ::before path). Must
 * stay Decoration.widget DOM, because attribute writes are ignored by DOMObserver.
 * TOC/header use React UnreadBadge. The TOC shares `resolveHeadingUnreadCount` with these widgets.
 */
export function syncHeadingWidgetUnread(): void {
  const source = useChatStore.getState()
  const wrappersToSync = new Set<HTMLElement>()

  const updateElement = (el: HTMLElement, count: number) => {
    const oldCount = parseInt(el.dataset.unreadCount || '0', 10)
    el.setAttribute('aria-label', formatHeadingChatAriaLabel(count))

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

    const wrapper = el.closest<HTMLElement>(`.${HEADING_ACTIONS_CLASSES.wrap}`)
    if (wrapper) wrappersToSync.add(wrapper)
  }

  document
    .querySelectorAll<HTMLElement>(`${headingChatBtnSelector}[data-heading-id]`)
    .forEach((el) => {
      const headingId = el.dataset.headingId
      if (!headingId) return
      updateElement(el, resolveHeadingUnreadCount(headingId, source))
    })

  wrappersToSync.forEach(syncHeadingWrapperA11y)
}
