import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { TOC_CLASSES } from '@components/toc/tocClasses'
import { SheetType, useChatStore, useSheetStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import { formatCappedCount } from '@utils/formatCappedCount'
import { NextRouter } from 'next/router'
import PubSub from 'pubsub-js'

import { CHAT_COMMENT, type TChatCommentData } from './chatEvents'
import { openCommentComposer, openHeadingChatBrowse } from './openHeadingChatroom'

export { CHAT_COMMENT, type TChatCommentData } from './chatEvents'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`
const tocChatTriggerSelector = `.${TOC_CLASSES.chatTrigger}`

export const CHAT_OPEN = Symbol('chat.open')
export const CHAT_CLOSE = Symbol('chat.close')
export const APPLY_FILTER = Symbol('apply.filter')
export const REMOVE_FILTER = Symbol('remove.filter')
export const RESET_FILTER = Symbol('reset.filter')
export const UNREAD_SYNC = Symbol('unread.sync')

type TOpenChatData = {
  headingId: string
  scroll2Heading?: boolean
  toggleRoom?: boolean
  fetchMsgsFromId?: string
  focusEditor?: boolean
  insertContent?: string | null
  clearSheetState?: boolean
  switchSheet?: SheetType
}

type TApplyFilterData = {
  href: string
}

type TRemoveFilterData = {
  slug: string
}

type TCloseChatData = {
  headingId: string
}

type TUnreadSyncData = {
  channels: Map<string, { unread_message_count?: number }>
}

export const eventsHub = (router: NextRouter) => {
  console.info('eventsHub initialized')

  PubSub.subscribe(CHAT_COMMENT, (msg, data: TChatCommentData) => {
    ensureEmojiData(true)
    openCommentComposer(data.anchor)
  })

  PubSub.subscribe(CHAT_OPEN, (msg, data: TOpenChatData) => {
    ensureEmojiData(true)
    const {
      headingId,
      scroll2Heading = false,
      toggleRoom = true,
      fetchMsgsFromId,
      focusEditor = false,
      insertContent = null,
      clearSheetState = false,
      switchSheet = null
    } = data

    if (!headingId) return

    const { headingId: openedHeadingId } = useChatStore.getState().chatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom

    if (openedHeadingId === headingId && toggleRoom) return destroyChatRoom()

    openHeadingChatBrowse({
      headingId,
      scroll2Heading,
      fetchMsgsFromId,
      focusEditor,
      insertContent
    })

    if (switchSheet) {
      useSheetStore.getState().switchSheet(switchSheet)
    } else if (clearSheetState) {
      useSheetStore.getState().clearSheetState()
    }
  })

  PubSub.subscribe(CHAT_CLOSE, (msg, data: TCloseChatData) => {
    const { headingId } = data
    const destroyChatRoom = useChatStore.getState().destroyChatRoom
    const setReplyMessageMemory = useChatStore.getState().setReplyMessageMemory
    const setCommentMessageMemory = useChatStore.getState().setCommentMessageMemory
    const setEditMessageMemory = useChatStore.getState().setEditMessageMemory

    if (headingId) {
      setReplyMessageMemory(headingId, null)
      setCommentMessageMemory(headingId, null)
      setEditMessageMemory(headingId, null)
    }
    destroyChatRoom()
  })

  PubSub.subscribe(APPLY_FILTER, (msg, data: TApplyFilterData) => {
    const { href } = data

    const url = new URL(href || router.asPath, window.location.origin)

    // Preserve the user's sticky filter mode when the clicked link omits it.
    if (!url.searchParams.has('mode')) {
      const mode = new URL(router.asPath, window.location.origin).searchParams.get('mode')
      if (mode) url.searchParams.set('mode', mode)
    }

    // Instant in-place fold — no full-doc skeleton; useApplyFilters reacts to the route.
    router.push(url.toString(), undefined, { shallow: true })
  })

  PubSub.subscribe(REMOVE_FILTER, (msg, data: TRemoveFilterData) => {
    const { slug } = data

    const url = new URL(location.href)
    const segments = url.pathname.split('/').filter(Boolean)
    if (!segments.length) return

    const [docSlug, ...filterSlugs] = segments

    // Case-insensitive comparison to handle URL encoding and case differences
    const updatedFilters = filterSlugs.filter(
      (segment) => slug && decodeURIComponent(segment).toLowerCase() !== slug.toLowerCase()
    )

    url.pathname = `/${docSlug}${updatedFilters.length ? '/' + updatedFilters.join('/') : ''}`

    router.push(url.toString(), undefined, { shallow: true })
  })

  PubSub.subscribe(RESET_FILTER, () => {
    const url = new URL(router.asPath, window.location.origin)
    const slugs = url.pathname.split('/').slice(1)

    // Preserve the search parameters; reset is an instant in-place unfold.
    const newUrl = `/${slugs.at(0)}${url.search}`

    router.push(newUrl, undefined, { shallow: true })
  })

  /**
   * UNREAD_SYNC: Updates unread count badges on the ProseMirror heading-action
   * chat buttons (`.ha-chat-btn`). Those buttons are vanilla DOM nodes injected
   * by a ProseMirror plugin and can't trivially host a React subtree, so they
   * stay on the data-attribute + CSS-`::before` path.
   *
   * Everything else (TOC, header, chatroom, notification bell) uses the React
   * <UnreadBadge> component directly. Do not set data-unread-count on those
   * surfaces — the TOC clear-step below exists for legacy cleanup.
   *
   * Animation direction:
   * - data-count-dir="up" → number slides from bottom (count increased)
   * - data-count-dir="down" → number slides from top (count decreased)
   */
  PubSub.subscribe(UNREAD_SYNC, (msg, data: TUnreadSyncData) => {
    const { channels } = data

    document.querySelectorAll<HTMLElement>(tocChatTriggerSelector).forEach((el) => {
      delete el.dataset.unreadCount
      delete el.dataset.countDir
    })

    /**
     * Helper: Update a single element with unread count + animation
     */
    const updateElement = (el: HTMLElement, count: number) => {
      const oldCount = parseInt(el.dataset.unreadCount || '0', 10)

      if (count > 0) {
        const displayCount = formatCappedCount(count)

        // Only animate if count actually changed
        if (count !== oldCount) {
          el.dataset.countDir = count > oldCount ? 'up' : 'down'
          el.style.animation = 'none'
          void el.offsetHeight // Force reflow
          el.style.animation = ''
        }

        el.dataset.unreadCount = displayCount
      } else {
        delete el.dataset.unreadCount
        delete el.dataset.countDir
      }
    }

    // Strategy 1: ProseMirror heading chat buttons (TOC badges are React-driven)
    document
      .querySelectorAll<HTMLElement>(`${headingChatBtnSelector}[data-heading-id]`)
      .forEach((el) => {
        const headingId = el.dataset.headingId
        if (!headingId) return

        const channel = channels.get(headingId)
        updateElement(el, channel?.unread_message_count ?? 0)
      })

    // Strategy 2: Fallback - Update elements near heading with data-toc-id
    channels.forEach((channel, channelId) => {
      if (!channel || channel.unread_message_count === undefined) return

      const headingEl = document.querySelector<HTMLElement>(`[data-toc-id="${channelId}"]`)
      if (!headingEl) return

      const el = headingEl.querySelector<HTMLElement>(
        `${headingChatBtnSelector}:not([data-heading-id])`
      )
      if (el) {
        updateElement(el, channel.unread_message_count ?? 0)
      }
    })
  })
}

/**
 * Publish UNREAD_SYNC event - call this when channels update.
 * Typically called from a zustand subscription or after fetching channels.
 */
export const publishUnreadSync = () => {
  const channels = useChatStore.getState().channels
  PubSub.publish(UNREAD_SYNC, { channels })
}
