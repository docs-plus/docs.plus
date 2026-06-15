import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { useStore } from '@stores'
import { TMsgRow } from '@types'
import { useCallback } from 'react'

/**
 * Hook for copying message deep links to clipboard.
 * Uses the shared useCopyToClipboard hook for consistent UX.
 */
export const useCopyMessageLinkHandler = () => {
  const { copy, copied, copying } = useCopyToClipboard({
    successMessage: 'Message link copied to clipboard'
  })

  const getMessageUrl = useCallback((message: TMsgRow): string => {
    const workspaceId = useStore.getState().settings.workspaceId || ''
    const documentSlug = location.pathname.split('/').pop()
    const channelId = message.channel_id || workspaceId
    const messageId = message.id

    // Canonical chat deep-link dialect (?chatroom=&msg_id=) on a clean doc URL —
    // the cold-load opener and in-doc <a> handler both resolve this shape.
    const url = new URL(window.location.origin)
    url.pathname = `/${documentSlug}`
    url.searchParams.set('chatroom', channelId)
    url.searchParams.set('msg_id', messageId)

    return url.toString()
  }, [])

  const copyMessageLinkHandler = useCallback(
    (message: TMsgRow) => {
      if (!message) return
      const url = getMessageUrl(message)
      copy(url)
    },
    [copy, getMessageUrl]
  )

  return { copyMessageLinkHandler, copied, copying, getMessageUrl }
}
