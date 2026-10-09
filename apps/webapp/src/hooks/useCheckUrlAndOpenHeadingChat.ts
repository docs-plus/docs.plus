import { openChatFromLink } from '@services/openChatFromLink'
import { useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

/** `linkId` is a channel id or a heading id; openChatFromLink tells them apart (#402). */
type ChatDeepLink = { linkId: string; fetchMsgsFromId?: string }

// Cold-load chat deep link → room-open intent. Canonical is ?chatroom=&msg_id=;
// ?act=ch&c_id=&m_id= is the legacy translator; ?open_heading_chat= is the
// post-sign-in composer return. Read-only opens — never gated on auth.
const resolveChatDeepLink = (url: URL): ChatDeepLink | null => {
  const openHeadingChatId = url.searchParams.get('open_heading_chat')
  if (openHeadingChatId) return { linkId: openHeadingChatId }

  const chatroomId = url.searchParams.get('chatroom')
  if (chatroomId) {
    return { linkId: chatroomId, fetchMsgsFromId: url.searchParams.get('msg_id') || undefined }
  }

  if (url.searchParams.get('act') === 'ch') {
    const channelId = url.searchParams.get('c_id')
    if (channelId) {
      return { linkId: channelId, fetchMsgsFromId: url.searchParams.get('m_id') || undefined }
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

    // Deps re-fire on auth transition (anon → signed in). Open each link once
    // per mount; openChatFromLink never toggles a room closed.
    const key = `${intent.linkId}:${intent.fetchMsgsFromId ?? ''}`
    if (handledRef.current === key) return
    handledRef.current = key

    // TODO: we need better flag rather than using setTimeout
    const timer = setTimeout(() => {
      void openChatFromLink(intent.linkId, { fetchMsgsFromId: intent.fetchMsgsFromId })
    }, 800)
    return () => clearTimeout(timer)
  }, [editorLoading, providerSyncing, slugs, workspaceId, user])
}

export default useCheckUrlAndOpenHeadingChat
