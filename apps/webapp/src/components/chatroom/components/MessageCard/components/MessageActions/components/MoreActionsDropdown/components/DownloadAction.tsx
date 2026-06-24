import { useDownloadMessageMediaHandler } from '@components/chatroom/components/MessageCard/hooks/useDownloadMessageMediaHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { Icons } from '@icons'

export const DownloadAction = () => {
  const { message, medias } = useMessageCardContext()
  const { downloadMessageMediaHandler, downloading } = useDownloadMessageMediaHandler()

  if (!message || medias.length === 0) return null

  let label = 'Download'
  if (downloading) {
    label = 'Downloading…'
  } else if (medias.length > 1) {
    label = `Download all (${medias.length})`
  }

  return (
    <li>
      <a
        className={`flex items-center gap-2 ${downloading ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={downloading}
        onClick={() => downloadMessageMediaHandler(message)}>
        <Icons.download size={18} />
        {label}
      </a>
    </li>
  )
}
