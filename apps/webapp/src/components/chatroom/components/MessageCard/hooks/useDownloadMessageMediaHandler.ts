import { downloadAllChatMedia } from '@components/chatroom/utils/chatMediaUrl'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { TMsgRow } from '@types'
import { useCallback, useRef } from 'react'

export const useDownloadMessageMediaHandler = () => {
  const inFlightRef = useRef(false)

  const downloadMessageMediaHandler = useCallback((message: TMsgRow) => {
    if (inFlightRef.current) return
    const medias = parseMessageMedias(message.medias)
    if (medias.length === 0) return

    inFlightRef.current = true
    void downloadAllChatMedia(medias).finally(() => {
      inFlightRef.current = false
    })
  }, [])

  return { downloadMessageMediaHandler }
}
