import { HEADING_ACTIONS_CLASSES } from '../types'

export const isMobileShellEnvironment = (wrapper?: HTMLElement): boolean => {
  if (typeof document === 'undefined') return false
  if (wrapper?.isConnected) return Boolean(wrapper.closest('.m_mobile'))
  return Boolean(document.querySelector('.mobileLayoutRoot.m_mobile, html.m_mobile'))
}

export const hasFineHoverEnvironment = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export const isElementHovered = (el: HTMLElement | null): boolean => {
  if (!el) return false
  try {
    return el.matches(':hover')
  } catch {
    return false
  }
}

const isElementHoveredOrFocused = (el: HTMLElement | null): boolean => {
  if (!el) return false
  try {
    if (el.matches(':hover') || el.matches(':focus-within')) return true
  } catch {
    // Fallback for environments without full selector matching
  }
  return typeof document !== 'undefined' && el.contains(document.activeElement)
}

const blurIfFocused = (el: HTMLElement): void => {
  const active = el.ownerDocument.activeElement
  if (active instanceof HTMLElement && (active === el || el.contains(active))) {
    active.blur()
  }
}

const hideButton = (button: HTMLButtonElement): void => {
  blurIfFocused(button)
  button.setAttribute('aria-hidden', 'true')
  button.tabIndex = -1
}

const hideGroup = (
  group: HTMLElement,
  groupChatBtn: HTMLButtonElement | null | undefined,
  groupCommentBtn: HTMLButtonElement | null | undefined
): void => {
  blurIfFocused(group)
  group.inert = true
  group.setAttribute('aria-hidden', 'true')
  if (groupChatBtn) {
    groupChatBtn.setAttribute('aria-hidden', 'true')
    groupChatBtn.tabIndex = -1
  }
  if (groupCommentBtn) {
    groupCommentBtn.setAttribute('aria-hidden', 'true')
    groupCommentBtn.tabIndex = -1
  }
}

/**
 * Sync `aria-hidden`, `tabIndex`, and `inert` on a `.ha-wrap` widget with its visibility.
 * Hidden buttons stay out of the accessibility tree and Tab order.
 */
export const syncHeadingWrapperA11y = (
  wrapper: HTMLElement,
  env?: { isMobileShell?: boolean; hasFineHover?: boolean }
): void => {
  const isMobileShell = env?.isMobileShell ?? isMobileShellEnvironment(wrapper)
  const hasFineHover = env?.hasFineHover ?? hasFineHoverEnvironment()
  const hasSelection = wrapper.classList.contains(HEADING_ACTIONS_CLASSES.hasSelection)
  const isSectionHover = wrapper.classList.contains(HEADING_ACTIONS_CLASSES.sectionHover)
  const headingEl = wrapper.closest<HTMLElement>('h1, h2, h3, h4, h5, h6')

  const singleBtn = wrapper.querySelector<HTMLButtonElement>(
    `:scope > .${HEADING_ACTIONS_CLASSES.single}`
  )
  const group = wrapper.querySelector<HTMLElement>(`:scope > .${HEADING_ACTIONS_CLASSES.group}`)
  const groupChatBtn = group?.querySelector<HTMLButtonElement>(
    `:scope > .${HEADING_ACTIONS_CLASSES.chatBtn}`
  )
  const groupCommentBtn = group?.querySelector<HTMLButtonElement>(
    `:scope > .${HEADING_ACTIONS_CLASSES.commentBtn}`
  )

  if (isMobileShell) {
    if (group) hideGroup(group, groupChatBtn, groupCommentBtn)
    if (singleBtn) {
      singleBtn.removeAttribute('aria-hidden')
      singleBtn.tabIndex = 0
    }
    return
  }

  if (hasSelection) {
    if (singleBtn) hideButton(singleBtn)
    if (!group) return

    group.inert = false
    group.removeAttribute('aria-hidden')

    if (groupCommentBtn) {
      groupCommentBtn.removeAttribute('aria-hidden')
      groupCommentBtn.tabIndex = 0
    }

    if (groupChatBtn) {
      const hasUnread = Boolean(groupChatBtn.dataset.unreadCount)
      const isHovered = isElementHovered(wrapper) || isElementHovered(headingEl)

      if (hasUnread || isHovered) {
        groupChatBtn.removeAttribute('aria-hidden')
        groupChatBtn.tabIndex = 0
      } else {
        hideButton(groupChatBtn)
      }
    }
    return
  }

  if (group) hideGroup(group, groupChatBtn, groupCommentBtn)
  if (!singleBtn) return

  const hasUnread = Boolean(singleBtn.dataset.unreadCount)
  const isFocused = singleBtn.ownerDocument.activeElement === singleBtn
  const wrapperOrHeadingHovered =
    isElementHoveredOrFocused(wrapper) || isElementHoveredOrFocused(headingEl)
  const visible = !hasFineHover || hasUnread || isSectionHover || wrapperOrHeadingHovered

  if (visible) {
    singleBtn.removeAttribute('aria-hidden')
    singleBtn.tabIndex = !hasFineHover || hasUnread || isFocused ? 0 : -1
  } else {
    hideButton(singleBtn)
  }
}
