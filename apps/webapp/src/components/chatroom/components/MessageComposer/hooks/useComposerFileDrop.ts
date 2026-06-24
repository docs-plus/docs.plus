import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { useAuthStore } from '@stores'
import { type DragEvent, useCallback, useState } from 'react'

import { useChatroomContext } from '../../../ChatroomContext'
import { useComposerAttachmentActions } from '../context/ComposerAttachmentActionsContext'

export function useComposerFileDrop() {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const { addFiles } = useComposerAttachmentActions()
  const [isDragging, setIsDragging] = useState(false)

  const canAccept = Boolean(user?.id)

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canAccept) return
      event.preventDefault()
      setIsDragging(true)
    },
    [canAccept]
  )

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setIsDragging(false)
  }, [])

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canAccept) return
      event.preventDefault()
    },
    [canAccept]
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      if (!user?.id) {
        openComposerSignIn(channelId)
        return
      }
      if (!canAccept || !event.dataTransfer.files.length) return
      addFiles(event.dataTransfer.files)
    },
    [addFiles, canAccept, channelId, user?.id]
  )

  return {
    dropHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
    dropSurfaceClassName: isDragging ? 'ring-primary ring-2 ring-inset' : undefined
  }
}
