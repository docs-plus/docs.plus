import { useCallback } from 'react'
import { TMsgRow } from '@types'
import { useStore } from '@stores'
import useCopyToClipboard from '@hooks/useCopyToClipboard'

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

    const url = new URL(window.location.origin)
    url.pathname = `/${documentSlug}`
    url.searchParams.set('act', 'ch')
    url.searchParams.set('c_id', channelId)
    url.searchParams.set('m_id', messageId)

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
