import {
  hasFineHoverEnvironment,
  isMobileShellEnvironment,
  syncHeadingWrapperA11y
} from '@components/TipTap/extensions/HeadingActions/plugins/headingWidgetA11y'
import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { useChatStore } from '@stores'
import { formatCappedCount } from '@utils/formatCappedCount'
import { resolveHeadingUnreadCount } from '@utils/unreadDisplay'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`
const syncedWrappers = new WeakSet<HTMLElement>()

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
  const elementsToRestart: HTMLElement[] = []

  document
    .querySelectorAll<HTMLElement>(`${headingChatBtnSelector}[data-heading-id]`)
    .forEach((el) => {
      const headingId = el.dataset.headingId
      if (!headingId) return

      const count = resolveHeadingUnreadCount(headingId, source)
      const prevDisplay = el.dataset.unreadCount ?? ''
      const nextDisplay = count > 0 ? formatCappedCount(count) : ''
      const hadUnread = prevDisplay !== ''
      const hasUnread = nextDisplay !== ''

      if (prevDisplay !== nextDisplay) {
        el.setAttribute('aria-label', formatHeadingChatAriaLabel(count))

        if (hasUnread) {
          const oldCount = parseInt(prevDisplay || '0', 10)
          el.dataset.countDir = count > oldCount ? 'up' : 'down'
          el.style.animation = 'none'
          elementsToRestart.push(el)
          el.dataset.unreadCount = nextDisplay
        } else {
          delete el.dataset.unreadCount
          delete el.dataset.countDir
        }
      }

      const wrapper = el.closest<HTMLElement>(`.${HEADING_ACTIONS_CLASSES.wrap}`)
      if (wrapper) {
        const isInitial = !syncedWrappers.has(wrapper)
        if (isInitial || hadUnread !== hasUnread) {
          syncedWrappers.add(wrapper)
          wrappersToSync.add(wrapper)
        }
      }
    })

  if (elementsToRestart.length > 0) {
    // Single layout flush for all updated badges before clearing inline animation.
    void elementsToRestart[0].offsetHeight
    for (const el of elementsToRestart) {
      el.style.animation = ''
    }
  }

  if (wrappersToSync.size > 0) {
    const firstWrapper = wrappersToSync.values().next().value
    const a11yEnv = {
      isMobileShell: isMobileShellEnvironment(firstWrapper),
      hasFineHover: hasFineHoverEnvironment()
    }
    for (const wrapper of wrappersToSync) {
      syncHeadingWrapperA11y(wrapper, a11yEnv)
    }
  }
}
