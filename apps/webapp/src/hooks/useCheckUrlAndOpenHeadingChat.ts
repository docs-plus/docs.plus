import { CHAT_OPEN } from '@services/eventsHub'
import { useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { useEffect, useRef } from 'react'

type ChatDeepLink = { headingId: string; fetchMsgsFromId?: string }

// Resolve a cold-load chat deep link from the URL into a room-open intent.
// Canonical dialect is ?chatroom=&msg_id=; ?act=ch&c_id=&m_id= is the legacy
// translator (kept so already-shared links keep working); ?open_heading_chat=
// is the post-sign-in composer return. All are read-only opens — never gated on
// auth, so a logged-out recipient opens a PUBLIC room.
const resolveChatDeepLink = (url: URL): ChatDeepLink | null => {
  const openHeadingChatId = url.searchParams.get('open_heading_chat')
  if (openHeadingChatId) return { headingId: openHeadingChatId }

  const chatroomId = url.searchParams.get('chatroom')
  if (chatroomId) {
    return { headingId: chatroomId, fetchMsgsFromId: url.searchParams.get('msg_id') || undefined }
  }

  if (url.searchParams.get('act') === 'ch') {
    const channelId = url.searchParams.get('c_id')
    if (channelId) {
      return { headingId: channelId, fetchMsgsFromId: url.searchParams.get('m_id') || undefined }
    }
  }
  return null
}

const useCheckUrlAndOpenHeadingChat = () => {
  const { slugs } = useRouter().query
  const user = useAuthStore((state) => state.profile)
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const editorLoading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    // Wait for the synced document or the chat opens over an empty doc and the
    // heading scroll has nothing to target. workspaceId-gated, never profile-gated.
    if (!workspaceId || editorLoading || providerSyncing) return

    const intent = resolveChatDeepLink(new URL(window.location.href))
    if (!intent) return

    // Deps re-fire on auth transition (anon → signed in); open each link once
    // per mount. toggleRoom:false so a re-fire can never auto-close the room.
    const key = `${intent.headingId}:${intent.fetchMsgsFromId ?? ''}`
    if (handledRef.current === key) return
    handledRef.current = key

    // TODO: we need better flag rather than using setTimeout
    const timer = setTimeout(() => {
      PubSub.publish(CHAT_OPEN, {
        headingId: intent.headingId,
        toggleRoom: false,
        fetchMsgsFromId: intent.fetchMsgsFromId
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [editorLoading, providerSyncing, slugs, workspaceId, user])
}

export default useCheckUrlAndOpenHeadingChat
