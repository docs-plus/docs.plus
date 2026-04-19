import { HEADING_ACTIONS_CLASSES } from '@components/TipTap/extensions/HeadingActions/types'
import { TOC_CLASSES } from '@components/toc/tocClasses'
import { SheetType, useAuthStore, useChatStore, useSheetStore, useStore } from '@stores'
import { scrollToHeading } from '@utils/index'
import { NextRouter } from 'next/router'
import PubSub from 'pubsub-js'

import { retryWithBackoff } from '../utils/retryWithBackoff'

const headingChatBtnSelector = `.${HEADING_ACTIONS_CLASSES.chatBtn}`
const tocChatTriggerSelector = `.${TOC_CLASSES.chatTrigger}`

export const CHAT_COMMENT = Symbol('chat.comment')
export const CHAT_OPEN = Symbol('chat.open')
export const CHAT_CLOSE = Symbol('chat.close')
export const APPLY_FILTER = Symbol('apply.filter')
export const REMOVE_FILTER = Symbol('remove.filter')
export const RESET_FILTER = Symbol('reset.filter')
export const UNREAD_SYNC = Symbol('unread.sync')

type TChatCommentData = {
  content: string
  html: string
  headingId: string
}

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
  slugs?: string[]
  href?: string
} & ({ slugs: string[] } | { href: string })

type TRemoveFilterData = {
  slug: string
}

type TCloseChatData = {
  headingId: string
}

type TResetFilterData = {
  callback: () => void
  applyFilters: boolean
}

type TUnreadSyncData = {
  channels: Map<string, { unread_message_count?: number }>
}

/**
 * Exit document edit mode before a mobile chat sheet seats, releasing the
 * iOS soft keyboard on the way out.
 *
 * Tiptap `setEditable(false)` synchronously runs `view.updateState(...)`,
 * which flips `contenteditable` on the editor DOM in the same tick — so
 * the attribute write is NOT load-bearing. What iOS Safari actually needs
 * is the focused element to *lose focus*: with `contenteditable=false` but
 * focus still on the host, the keyboard stays up. That's why the final
 * `view.dom.blur()` is the critical line here.
 *
 * Simpler than `previewHyperlink.dismissSoftKeyboard`: that helper must
 * collapse the selection and defer the blur one tick to win a race against
 * ProseMirror's same-tick selection management on link taps. Here the
 * callers already gate the `openSheet` call with a 200 ms `setTimeout`,
 * and `setEditable(false)` prevents ProseMirror from re-asserting focus,
 * so a synchronous blur is enough.
 *
 * No-op when the keyboard is already down.
 */
const exitDocEditModeForSheet = (): void => {
  const { isKeyboardOpen, settings, setWorkspaceEditorSetting } = useStore.getState()
  if (!isKeyboardOpen) return
  const editor = settings.editor.instance
  if (!editor) return
  setWorkspaceEditorSetting('isEditable', false)
  editor.setEditable(false)
  editor.view.dom.blur()
}

export const eventsHub = (router: NextRouter) => {
  console.info('eventsHub initialized')

  PubSub.subscribe(CHAT_COMMENT, (msg, data: TChatCommentData) => {
    const { content, html, headingId } = data
    const { workspaceId } = useStore.getState().settings
    const { headingId: openedHeadingId } = useChatStore.getState().chatRoom
    const user = useAuthStore.getState().profile

    const setCommentMessageMemory = useChatStore.getState().setCommentMessageMemory
    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom
    const switchChatRoom = useChatStore.getState().switchChatRoom

    switchChatRoom(headingId)

    setCommentMessageMemory(headingId, {
      content,
      html,
      channel_id: headingId,
      workspace_id: workspaceId,
      user
    })

    if (headingId === openedHeadingId) return destroyChatRoom()

    exitDocEditModeForSheet()

    setTimeout(() => {
      if (workspaceId) {
        setChatRoom(headingId, workspaceId, [], user)
        useChatStore.getState().openChatRoom()
        useSheetStore.getState().openSheet('chatroom', { headingId })
      }
    }, 200)
  })

  PubSub.subscribe(CHAT_OPEN, (msg, data: TOpenChatData) => {
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

    const { workspaceId } = useStore.getState().settings
    const user = useAuthStore.getState().profile
    const { headingId: openedHeadingId } = useChatStore.getState().chatRoom

    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom
    const switchChatRoom = useChatStore.getState().switchChatRoom

    if (openedHeadingId === headingId && toggleRoom) return destroyChatRoom()

    switchChatRoom(headingId)

    setTimeout(() => {
      // TODO: change naming => open chatroom
      if (workspaceId) {
        setChatRoom(headingId, workspaceId, [], user, fetchMsgsFromId)
        useChatStore.getState().openChatRoom()
        useSheetStore.getState().openSheet('chatroom', { headingId })
      }

      if (scroll2Heading) scrollToHeading(headingId)
    }, 200)

    exitDocEditModeForSheet()

    if (insertContent) {
      retryWithBackoff(
        () => {
          const { editorInstance } = useChatStore.getState().chatRoom
          const { sheetState, isSheetOpen } = useSheetStore.getState()

          // Return false to retry, true when condition is met
          if (sheetState === 'open' && editorInstance && insertContent && isSheetOpen('chatroom')) {
            editorInstance.chain().focus().insertContent(insertContent).run()
            return true
          } else if (isSheetOpen('chatroom') && editorInstance) {
            // make sure we insert the content in the editor
            // if the sheetState goes wrong, change the sheetState to open
            useSheetStore.getState().setSheetState('open')
            return false // This will trigger a retry
          }

          return false // This will trigger a retry
        },
        {
          maxAttempts: 6,
          initialDelayMs: 600,
          maxDelayMs: 1000,
          onRetry: (attempt, error) => {
            console.info(`Attempt ${attempt} failed: ${error.message}. Retrying...`)
          }
        }
      ).then((_result) => {
        // do nothing
      })
    }

    if (focusEditor) {
      retryWithBackoff(
        () => {
          const { editorInstance } = useChatStore.getState().chatRoom
          if (editorInstance && focusEditor) {
            editorInstance.commands.focus()
            return true
          }
          return false
        },
        {
          maxAttempts: 6,
          initialDelayMs: 600,
          maxDelayMs: 1000,
          onRetry: (attempt, error) => {
            console.info(`Attempt ${attempt} failed: ${error.message}. Retrying...`)
          }
        }
      )
    }

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
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
    const { slugs, href } = data

    // if (!href || !slugs) {
    //   console.error('[EventsHub]: apply filter: invalid data', data)
    //   return
    // }

    const url = new URL(href || router.asPath, window.location.origin)
    if (!href && slugs) url.pathname = `${url.pathname}/${encodeURIComponent(slugs.join('/'))}`

    router.push(url.toString(), undefined, { shallow: true })

    setWorkspaceEditorSetting('applyingFilters', true)
  })

  PubSub.subscribe(REMOVE_FILTER, (msg, data: TRemoveFilterData) => {
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
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
    setWorkspaceEditorSetting('applyingFilters', true)
  })

  PubSub.subscribe(RESET_FILTER, (msg, data: TResetFilterData) => {
    const { callback, applyFilters = true } = data
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
    const url = new URL(router.asPath, window.location.origin)
    const slugs = url.pathname.split('/').slice(1)

    // Preserve the search parameters
    const newUrl = `/${slugs.at(0)}${url.search}`

    router.push(newUrl, undefined, { shallow: true })
    setTimeout(() => {
      setWorkspaceEditorSetting('applyingFilters', applyFilters)
      if (callback) callback()
    }, 500)
  })

  /**
   * UNREAD_SYNC: Updates unread count badges via DOM attributes.
   * CSS handles all visuals and animations - zero React re-renders.
   *
   * Animation direction:
   * - data-count-dir="up" → number slides from bottom (count increased)
   * - data-count-dir="down" → number slides from top (count decreased)
   *
   * Selectors updated (by data-heading-id):
   * - .ha-chat-btn[data-heading-id] (editor heading chat, ProseMirror)
   *
   * TOC uses React (useUnreadCount + UnreadBadge); do not set data-unread-count on .toc__chat-trigger.
   *
   * Fallback (inside [data-toc-id] heading):
   * - .ha-chat-btn without data-heading-id (legacy)
   *
   * - [data-notification-badge] (notification bell)
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
        const displayCount = count > 99 ? '99+' : String(count)

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

    // Update notification bell badge
    const totalUnread = Array.from(channels.values()).reduce(
      (sum, ch) => sum + (ch?.unread_message_count ?? 0),
      0
    )

    document.querySelectorAll<HTMLElement>('[data-notification-badge]').forEach((el) => {
      updateElement(el, totalUnread)
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
