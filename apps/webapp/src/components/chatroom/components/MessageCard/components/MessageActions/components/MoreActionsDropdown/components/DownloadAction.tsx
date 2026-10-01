import { useDownloadMessageMediaHandler } from '@components/chatroom/components/MessageCard/hooks/useDownloadMessageMediaHandler'
import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import { ContextMenuRow, MenuItem } from '@components/ui/ContextMenu'
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
    <MenuItem disabled={downloading} onClick={() => downloadMessageMediaHandler(message)}>
      <ContextMenuRow icon={<Icons.download size={16} />} disabled={downloading}>
        {label}
      </ContextMenuRow>
    </MenuItem>
  )
}
