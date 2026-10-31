import { useChatStore } from '@stores'
import { ensureEmojiData } from '@utils/ensureEmojiData'
import PubSub from 'pubsub-js'

import { CHAT_COMMENT, type TChatCommentData } from './chatEvents'
import {
  focusHeadingChatTrigger,
  openCommentComposer,
  openHeadingChatBrowse
} from './openHeadingChatroom'
import { padUrl } from './padUrl'

export { CHAT_COMMENT, type TChatCommentData } from './chatEvents'

export const CHAT_OPEN = Symbol('chat.open')
export const CHAT_CLOSE = Symbol('chat.close')
/** A push click marked a read; the bell count and the panel summary refetch. */
export const NOTIFICATION_STATE_CHANGED = Symbol('notification.stateChanged')

export function closeHeadingChatroom(): void {
  const headingId = useChatStore.getState().chatRoom.headingId
  PubSub.publish(CHAT_CLOSE, { headingId })
  void padUrl.go({ kind: 'chatClosed', headingId: headingId ?? null })
}

type TOpenChatData = {
  headingId: string
  scroll2Heading?: boolean
  toggleRoom?: boolean
  fetchMsgsFromId?: string
  focusEditor?: boolean
}

type TCloseChatData = {
  headingId: string
}

export const eventsHub = () => {
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
        focusEditor = false
      } = data

      if (!headingId) return

      const { headingId: openedHeadingId, paneMode } = useChatStore.getState().chatRoom
      // headingId alone is not "open" — switchChatRoom writes it before the pane
      // seeds expanded. A second subscriber (or a later tap) must not treat that
      // as a toggle-close. The 200ms open delay used to hide this.
      if (openedHeadingId === headingId && toggleRoom && paneMode !== 'closed') {
        closeHeadingChatroom()
        return
      }

      openHeadingChatBrowse({
        headingId,
        scroll2Heading,
        fetchMsgsFromId,
        focusEditor
      })
    }),

    PubSub.subscribe(CHAT_CLOSE, (_msg, data: TCloseChatData) => {
      const { headingId } = data
      const {
        chatRoom,
        destroyChatRoom,
        setReplyMessageMemory,
        setCommentMessageMemory,
        setEditMessageMemory
      } = useChatStore.getState()

      // A pending comment may still sit under the heading id; the composer keys by channel id.
      for (const key of new Set([headingId, chatRoom.channelId])) {
        if (!key) continue
        setReplyMessageMemory(key, null)
        setCommentMessageMemory(key, null)
        setEditMessageMemory(key, null)
      }
      destroyChatRoom()
      focusHeadingChatTrigger(headingId)
    })
  ]

  return () => {
    tokens.forEach((token) => PubSub.unsubscribe(token))
  }
}
