import { downloadAllChatMedia } from '@components/chatroom/utils/chatMediaUrl'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { TMsgRow } from '@types'
import { useCallback, useRef, useState } from 'react'

/** Downloads every attachment on a message (single file or batch); guards re-entry. */
export const useDownloadMessageMediaHandler = () => {
  const [downloading, setDownloading] = useState(false)
  const inFlightRef = useRef(false)

  const downloadMessageMediaHandler = useCallback((message: TMsgRow) => {
    if (inFlightRef.current) return
    const medias = parseMessageMedias(message.medias)
    if (medias.length === 0) return

    inFlightRef.current = true
    setDownloading(true)
    void downloadAllChatMedia(medias).finally(() => {
      inFlightRef.current = false
      setDownloading(false)
    })
  }, [])

  return { downloadMessageMediaHandler, downloading }
}
