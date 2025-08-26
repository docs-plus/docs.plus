import { useCallback } from 'react'
import { TMsgRow } from '@types'
import { useStore } from '@stores'
import { copyToClipboard } from '@utils/index'
import * as toast from '@components/toast'

export const useCopyMessageLinkHandler = () => {
  const copyMessageLinkHandler = useCallback((message: TMsgRow) => {
    if (!message) return

    const workspaceId = useStore.getState().settings.workspaceId || ''
    const documentSlug = location.pathname.split('/').pop()
    const channelId = message.channel_id || workspaceId
    const messageId = message.id

    const url = new URL(window.location.origin)
    url.pathname = `/${documentSlug}`
    url.searchParams.set('act', 'ch')
    url.searchParams.set('c_id', channelId)
    url.searchParams.set('m_id', messageId)

    copyToClipboard(url.toString())
    toast.Success('Message link copied to clipboard')
  }, [])

  return { copyMessageLinkHandler }
}
