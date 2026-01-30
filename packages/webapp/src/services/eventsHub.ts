import { SheetType,useAuthStore, useChatStore, useSheetStore, useStore } from '@stores'
import { scrollToHeading } from '@utils/index'
import { NextRouter } from 'next/router'
import PubSub from 'pubsub-js'

import { retryWithBackoff } from '../utils/retryWithBackoff'

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

export const eventsHub = (router: NextRouter) => {
  console.info('eventsHub initialized')

  PubSub.subscribe(CHAT_COMMENT, (msg, data: TChatCommentData) => {
    const { content, html, headingId } = data
    const { workspaceId } = useStore.getState().settings
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom
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

    if (headingId === opendHeadingId) return destroyChatRoom()

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
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom

    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom
    const switchChatRoom = useChatStore.getState().switchChatRoom

    if (opendHeadingId === headingId && toggleRoom) return destroyChatRoom()

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

    const { isKeyboardOpen, settings } = useStore.getState()

    // if the keyboard is open, unfocus the document editor
    if (isKeyboardOpen) {
      const proseMirrorEl = document.querySelector('.tiptap.ProseMirror') as HTMLElement
      proseMirrorEl?.setAttribute('contenteditable', 'false')
      useStore.getState().setWorkspaceEditorSetting('isEditable', false)
      settings.editor.instance?.setEditable(false)
    }

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
   * - .btnOpenChatBox[data-heading-id] (floating chat buttons via ProseMirror)
   * - .btn_chat[data-heading-id] (TOC chat buttons)
   * - .btn_openChatBox[data-heading-id] (mobile chat buttons)
   *
   * Fallback selectors (by parent wrapBlock):
   * - .wrapBlock[data-id] > .title .btnOpenChatBox
   * - .wrapBlock[data-id] > .title .ha-group
   * - .wrapBlock[data-id] > .buttonWrapper .btn_openChatBox
   *
   * - [data-notification-badge] (notification bell)
   */
  PubSub.subscribe(UNREAD_SYNC, (msg, data: TUnreadSyncData) => {
    const { channels } = data

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

    // Strategy 1: Update elements with data-heading-id attribute
    const directSelectors = [
      '.btnOpenChatBox[data-heading-id]',
      '.btn_chat[data-heading-id]',
      '.btn_openChatBox[data-heading-id]'
    ]

    document.querySelectorAll<HTMLElement>(directSelectors.join(',')).forEach((el) => {
      const headingId = el.dataset.headingId
      if (!headingId) return

      const channel = channels.get(headingId)
      updateElement(el, channel?.unread_message_count ?? 0)
    })

    // Strategy 2: Fallback - Update elements via parent wrapBlock[data-id]
    // (for elements that don't have data-heading-id yet)
    channels.forEach((channel, channelId) => {
      if (!channel || channel.unread_message_count === undefined) return

      const fallbackSelectors = [
        `.wrapBlock[data-id="${channelId}"] > .title .btnOpenChatBox:not([data-heading-id])`,
        `.wrapBlock[data-id="${channelId}"] > .title .ha-group`,
        `.wrapBlock[data-id="${channelId}"] > .buttonWrapper .btn_openChatBox:not([data-heading-id])`
      ]

      fallbackSelectors.forEach((selector) => {
        const el = document.querySelector<HTMLElement>(selector)
        if (el) {
          updateElement(el, channel.unread_message_count ?? 0)
        }
      })
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
