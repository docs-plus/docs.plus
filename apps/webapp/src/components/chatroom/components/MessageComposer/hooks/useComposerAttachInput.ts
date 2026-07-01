import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  CHAT_MEDIA_ACCEPT,
  CHAT_MEDIA_MAX_ATTACHMENTS
} from '@components/chatroom/utils/messageMediaPaths'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { useAuthStore, useStore } from '@stores'
import { type ChangeEvent, useCallback, useRef } from 'react'

import { useComposerAttachmentActions } from '../context/ComposerAttachmentActionsContext'
import { useComposerAttachmentList } from './useComposerAttachmentList'

export function useComposerAttachInput() {
  const { channelId } = useChatroomContext()
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const user = useAuthStore((state) => state.profile)
  const { addFiles } = useComposerAttachmentActions()
  const attachments = useComposerAttachmentList(workspaceId, channelId)
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = attachments.length >= CHAT_MEDIA_MAX_ATTACHMENTS

  const openFilePicker = useCallback(() => {
    if (!user?.id) {
      openComposerSignIn(channelId)
      return
    }
    if (atLimit) return
    inputRef.current?.click()
  }, [atLimit, channelId, user?.id])

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (files?.length) addFiles(files)
      event.target.value = ''
    },
    [addFiles]
  )

  return {
    inputRef,
    onInputChange,
    openFilePicker,
    atLimit,
    accept: CHAT_MEDIA_ACCEPT
  }
}
