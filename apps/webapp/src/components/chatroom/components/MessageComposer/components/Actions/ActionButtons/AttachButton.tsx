import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  CHAT_MEDIA_ACCEPT,
  CHAT_MEDIA_MAX_ATTACHMENTS,
  CHAT_MEDIA_MAX_BYTES
} from '@components/chatroom/utils/messageMediaPaths'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { useCallback, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { useComposerAttachmentActions, useComposerAttachmentList } from '../../../hooks'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const AttachButton = ({ className, size = 18, ...props }: Props) => {
  const { channelId } = useChatroomContext()
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const user = useAuthStore((state) => state.profile)
  const { addFiles } = useComposerAttachmentActions()
  const attachments = useComposerAttachmentList(workspaceId, channelId)
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = attachments.length >= CHAT_MEDIA_MAX_ATTACHMENTS

  const onPress = useCallback(() => {
    if (!user?.id) {
      openComposerSignIn(channelId)
      return
    }
    if (atLimit) return
    inputRef.current?.click()
  }, [atLimit, channelId, user?.id])

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (files?.length) addFiles(files)
      event.target.value = ''
    },
    [addFiles]
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        {...(CHAT_MEDIA_ACCEPT ? { accept: CHAT_MEDIA_ACCEPT } : {})}
        multiple
        className="sr-only"
        tabIndex={-1}
        data-testid="composer-attach-input"
        aria-label={`Attach files up to ${Math.round(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))} MB each`}
        onChange={onChange}
      />
      <Button
        className={twMerge(
          'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
          atLimit && 'opacity-40',
          className
        )}
        onPress={onPress}
        tooltip={
          atLimit ? `Attachment limit reached (${CHAT_MEDIA_MAX_ATTACHMENTS})` : 'Attach file'
        }
        tooltipPosition="top"
        aria-label="Attach file"
        aria-disabled={atLimit}
        {...props}>
        <Icons.upload size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
      </Button>
    </>
  )
}
