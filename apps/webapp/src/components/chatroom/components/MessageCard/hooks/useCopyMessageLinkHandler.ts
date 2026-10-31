import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { padUrl } from '@services/padUrl'
import { selectDocumentId, useStore } from '@stores'
import { TMsgRow } from '@types'
import { useCallback } from 'react'

export const useCopyMessageLinkHandler = () => {
  const { copy, copied, copying } = useCopyToClipboard({
    successMessage: 'Message link copied to clipboard'
  })

  const getMessageUrl = useCallback((message: TMsgRow): string => {
    const workspaceId = selectDocumentId(useStore.getState()) || ''
    const linkId = message.channel_id || workspaceId
    return padUrl.link({ kind: 'chat', linkId, messageId: message.id })
  }, [])

  const copyMessageLinkHandler = useCallback(
    (message: TMsgRow) => copy(getMessageUrl(message)),
    [copy, getMessageUrl]
  )

  return { copyMessageLinkHandler, copied, copying, getMessageUrl }
}
