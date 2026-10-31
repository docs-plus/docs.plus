import { openChatFromLink } from '@services/openChatFromLink'
import { padUrl } from '@services/padUrl'
import { selectDocumentId, useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

/** Cold-load chat link: ?chatroom=&msg_id=, the legacy ?act=ch form, or the sign-in return. */
const readChatDeepLink = (): { linkId: string; fetchMsgsFromId?: string } | null => {
  const pad = padUrl.read()
  if (pad?.signInChat) return { linkId: pad.signInChat }
  return pad?.chat ? { linkId: pad.chat.linkId, fetchMsgsFromId: pad.chat.messageId } : null
}

const useCheckUrlAndOpenHeadingChat = () => {
  const { slugs } = useRouter().query
  const user = useAuthStore((state) => state.profile)
  const workspaceId = useStore(selectDocumentId)
  const editorLoading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    // Wait for the synced document or the chat opens over an empty doc and the
    // heading scroll has nothing to target. workspaceId-gated, never profile-gated.
    if (!workspaceId || editorLoading || providerSyncing) return

    const intent = readChatDeepLink()
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
