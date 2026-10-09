import { getHeadingIdForChannel } from '@api'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { headingAncestry } from '@utils/headingSlugTrail'
import PubSub from 'pubsub-js'

import { pickLinkedHeading } from './pickLinkedHeading'

type ChatLinkOptions = {
  fetchMsgsFromId?: string
  scroll2Heading?: boolean
  /** Tear down an open room on the same heading first, so it refetches at the message. */
  reopen?: boolean
}

const findChannelHeadingId = async (
  documentId: string,
  channelId: string
): Promise<string | null> => {
  const row = useChatStore.getState().channels.get(channelId)
  if (row?.workspace_id === documentId && row.heading_id) return row.heading_id
  try {
    return await getHeadingIdForChannel(documentId, channelId)
  } catch {
    return null
  }
}

/**
 * Opens the chat a link names (#402). Push, email and message links carry a channel id;
 * share and sign-in return links carry a heading id. Only this document's channels and
 * headings open, so a channel of another document opens nothing.
 */
export async function openChatFromLink(
  linkId: string,
  options: ChatLinkOptions = {}
): Promise<void> {
  const { workspaceId, editor } = useStore.getState().settings
  if (!linkId || !workspaceId) return
  const channelHeadingId = await findChannelHeadingId(workspaceId, linkId)
  const instance = editor.instance
  const isLiveHeading = Boolean(instance && headingAncestry(instance, linkId).length > 0)
  const headingId = pickLinkedHeading({
    linkId,
    channelHeadingId,
    isLiveHeading,
    documentId: workspaceId
  })
  if (!headingId || useStore.getState().settings.workspaceId !== workspaceId) return

  const { chatRoom, destroyChatRoom } = useChatStore.getState()
  if (options.reopen && chatRoom.headingId === headingId) destroyChatRoom()

  PubSub.publish(CHAT_OPEN, {
    headingId,
    toggleRoom: false,
    fetchMsgsFromId: options.fetchMsgsFromId,
    scroll2Heading: options.scroll2Heading
  })
}
