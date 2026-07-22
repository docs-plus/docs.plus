import { SheetType, useChatStore, useSheetStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import { removeFilterSegment, resetFilterPath, shallowPathFromAsPath } from '@utils/filterRoute'
import { NextRouter } from 'next/router'
import PubSub from 'pubsub-js'

import { CHAT_COMMENT, type TChatCommentData } from './chatEvents'
import { openCommentComposer, openHeadingChatBrowse } from './openHeadingChatroom'

export { CHAT_COMMENT, type TChatCommentData } from './chatEvents'

export const CHAT_OPEN = Symbol('chat.open')
export const CHAT_CLOSE = Symbol('chat.close')
export const APPLY_FILTER = Symbol('apply.filter')
export const REMOVE_FILTER = Symbol('remove.filter')
export const RESET_FILTER = Symbol('reset.filter')

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
    void router.push(shallowPathFromAsPath(url.toString()), undefined, { shallow: true })
  })

  PubSub.subscribe(REMOVE_FILTER, (msg, data: TRemoveFilterData) => {
    const href = removeFilterSegment(router.asPath, data.slug)
    if (!href) return
    void router.push(href, undefined, { shallow: true })
  })

  PubSub.subscribe(RESET_FILTER, () => {
    const href = resetFilterPath(router.asPath)
    if (!href) return
    void router.push(href, undefined, { shallow: true })
  })
}
