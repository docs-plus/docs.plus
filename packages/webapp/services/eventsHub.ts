import PubSub from 'pubsub-js'
import { useChatStore, useAuthStore, useStore } from '@stores'
import { Database } from '@types'

type TUser = Database['public']['Tables']['users']['Row']

export const CHAT_COMMENT = Symbol('chat.comment')
export const CHAT_OPEN = Symbol('chat.open')

type TChatCommentData = {
  content: string
  html: string
  headingId: string
}

export const eventsHub = () => {
  console.info('eventsHub initialized')

  PubSub.subscribe(CHAT_COMMENT, (msg, data: TChatCommentData) => {
    const { content, html, headingId } = data
    const { workspaceId } = useStore.getState().settings
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom
    const user = useAuthStore.getState().profile

    const setCommentMessageMemory = useChatStore.getState().setCommentMessageMemory
    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom

    setCommentMessageMemory(headingId, {
      content,
      html,
      channel_id: headingId,
      workspace_id: workspaceId,
      user
    })

    if (headingId === opendHeadingId) {
      return destroyChatRoom()
    }

    if (workspaceId) setChatRoom(headingId, workspaceId, [], user)
  })

  PubSub.subscribe(CHAT_OPEN, (msg, data) => {
    const { headingId } = data

    if (!headingId) return

    const { workspaceId } = useStore.getState().settings
    const user = useAuthStore.getState().profile
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom

    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom

    if (opendHeadingId === headingId) {
      return destroyChatRoom()
    }

    destroyChatRoom()

    // TODO: change naming => open chatroom
    if (workspaceId) setChatRoom(headingId, workspaceId, [], user)
  })
}
