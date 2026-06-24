import Chatroom from '@components/chatroom/Chatroom'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

function bootstrapE2EChannel(channelId: string, fetchMsgsFromId?: string | null) {
  const e2eProfile = {
    id: 'user-1',
    username: 'tester',
    full_name: 'Tester'
  } as ReturnType<typeof useAuthStore.getState>['profile']
  useAuthStore.getState().setProfile(e2eProfile)
  useAuthStore.getState().setSession({ user: { id: 'user-1' } }, false)

  useChatStore
    .getState()
    .setChatRoom(channelId, 'e2e-doc', [], e2eProfile, fetchMsgsFromId ?? undefined)
  useChatStore.getState().openChatRoom()
  useChatStore.getState().bootstrapChannel(
    channelId,
    {
      channel_info: { id: channelId, type: 'PUBLIC', name: channelId, slug: channelId },
      is_user_channel_member: true,
      is_user_channel_owner: true,
      is_user_channel_admin: true,
      channel_member_info: { member_id: e2eProfile!.id, channel_id: channelId },
      pinned_messages: [],
      peer_max_read_seq: null
    } as any,
    e2eProfile!.id
  )
  useStore.getState().setWorkspaceSetting('workspaceId', 'e2e-workspace')
  useStore.getState().setWorkspaceSetting('metadata', { documentId: 'e2e-doc' })
}

export default function E2EChatroomPage() {
  const router = useRouter()
  const channelId = typeof router.query.channelId === 'string' ? router.query.channelId : ''
  const msgParam =
    typeof router.query.msg === 'string'
      ? router.query.msg
      : typeof router.query.msg_id === 'string'
        ? router.query.msg_id
        : null

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== 'true' || !channelId) return
    bootstrapE2EChannel(channelId, msgParam)
  }, [channelId, msgParam])

  if (process.env.NEXT_PUBLIC_E2E !== 'true') {
    return null
  }

  if (!channelId) return null

  return (
    <div className="bg-base-100 flex h-dvh flex-col">
      <Chatroom variant="desktop" className="flex min-h-0 flex-1 flex-col">
        <Chatroom.Toolbar>
          <span className="text-sm font-medium">E2E Chat</span>
          <div className="ml-auto flex items-center gap-1">
            <Chatroom.Toolbar.MediaFilterToggle />
          </div>
        </Chatroom.Toolbar>
        <Chatroom.MessageFeed showScrollToBottom />
        <Chatroom.ChannelComposer className="w-full" />
      </Chatroom>
    </div>
  )
}
