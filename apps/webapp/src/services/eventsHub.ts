import { useChatStore } from '@stores'
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

  const tokens = [
    PubSub.subscribe(CHAT_COMMENT, (_msg, data: TChatCommentData) => {
      ensureEmojiData(true)
      openCommentComposer(data.anchor)
    }),

    PubSub.subscribe(CHAT_OPEN, (_msg, data: TOpenChatData) => {
      ensureEmojiData(true)
      const {
        headingId,
        scroll2Heading = false,
        toggleRoom = true,
        fetchMsgsFromId,
        focusEditor = false,
        insertContent = null
      } = data

      if (!headingId) return

      const { headingId: openedHeadingId, paneMode } = useChatStore.getState().chatRoom
      // headingId alone is not "open" — switchChatRoom writes it before the pane
      // seeds expanded. A second subscriber (or a later tap) must not treat that
      // as a toggle-close. The 200ms open delay used to hide this.
      if (openedHeadingId === headingId && toggleRoom && paneMode !== 'closed') {
        useChatStore.getState().destroyChatRoom()
        return
      }

      openHeadingChatBrowse({
        headingId,
        scroll2Heading,
        fetchMsgsFromId,
        focusEditor,
        insertContent
      })
    }),

    PubSub.subscribe(CHAT_CLOSE, (_msg, data: TCloseChatData) => {
      const { headingId } = data
      const {
        destroyChatRoom,
        setReplyMessageMemory,
        setCommentMessageMemory,
        setEditMessageMemory
      } = useChatStore.getState()

      if (headingId) {
        setReplyMessageMemory(headingId, null)
        setCommentMessageMemory(headingId, null)
        setEditMessageMemory(headingId, null)
      }
      destroyChatRoom()
    }),

    PubSub.subscribe(APPLY_FILTER, (_msg, data: TApplyFilterData) => {
      const { href } = data

      const url = new URL(href || router.asPath, window.location.origin)

      // Preserve the user's sticky filter mode when the clicked link omits it.
      if (!url.searchParams.has('mode')) {
        const mode = new URL(router.asPath, window.location.origin).searchParams.get('mode')
        if (mode) url.searchParams.set('mode', mode)
      }

      // Instant in-place fold — no full-doc skeleton; useApplyFilters reacts to the route.
      void router.push(shallowPathFromAsPath(url.toString()), undefined, { shallow: true })
    }),

    PubSub.subscribe(REMOVE_FILTER, (_msg, data: TRemoveFilterData) => {
      const href = removeFilterSegment(router.asPath, data.slug)
      if (!href) return
      void router.push(href, undefined, { shallow: true })
    }),

    PubSub.subscribe(RESET_FILTER, () => {
      const href = resetFilterPath(router.asPath)
      if (!href) return
      void router.push(href, undefined, { shallow: true })
    })
  ]

  return () => {
    tokens.forEach((token) => PubSub.unsubscribe(token))
  }
}
