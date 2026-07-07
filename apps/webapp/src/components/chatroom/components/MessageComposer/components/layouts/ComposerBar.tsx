import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { CHAT_MEDIA_MAX_ATTACHMENTS } from '@components/chatroom/utils/messageMediaPaths'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { useAuthStore, useStore } from '@stores'
import { useCallback, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { registerComposerVoiceStop } from '../../helpers/composerVoiceRecording'
import { useComposerAttachmentActions, useComposerAttachmentList } from '../../hooks'
import { useComposerFileDrop } from '../../hooks/useComposerFileDrop'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import MsgComposer from '../../MessageComposer'
import { ComposerInsertMenu } from '../Actions/ActionButtons/ComposerInsertMenu'
import { ComposerPrimaryAction } from '../Actions/ActionButtons/ComposerPrimaryAction'
import { AttachmentStrip } from '../Attachments/AttachmentStrip'
import { ComposerContextBars } from '../Context/ComposerContextBars'
import { VoiceRecordingBar } from '../VoiceRecordingBar'
import { ComposerFormatPanel } from './ComposerFormatPanel'
import { FormattingToolbar } from './FormattingToolbar'

type Props = {
  variant: keyof ChatroomVariant
  className?: string
}

export function ComposerBar({ variant, className }: Props) {
  const isDesktop = variant === 'desktop'
  const isMobile = !isDesktop
  const { channelId } = useChatroomContext()
  const { canSend } = useMessageComposer()
  const user = useAuthStore((state) => state.profile)
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const { addFiles } = useComposerAttachmentActions()
  const attachments = useComposerAttachmentList(workspaceId, channelId)
  const { dropHandlers, dropSurfaceClassName } = useComposerFileDrop()

  const voice = useVoiceRecorder({
    onAttach: (file) => addFiles([file]),
    attachmentCount: attachments.length,
    maxAttachments: CHAT_MEDIA_MAX_ATTACHMENTS,
    onAuthRequired: () => openComposerSignIn(channelId),
    userId: user?.id
  })

  const stopVoiceRef = useRef(voice.stopAndCleanup)
  stopVoiceRef.current = voice.stopAndCleanup

  useEffect(() => {
    registerComposerVoiceStop(() => stopVoiceRef.current())
    return () => registerComposerVoiceStop(null)
  }, [])

  useEffect(() => {
    return () => stopVoiceRef.current()
  }, [])

  const onVoiceFromMenu = useCallback(() => {
    void voice.startLockedFromMenu()
  }, [voice])

  const rowDimmed = voice.phase === 'recording' && !voice.isLocked

  return (
    <div
      data-chat-composer-surface
      {...dropHandlers}
      className={twMerge(
        'composer-bar flex flex-col overflow-hidden',
        isDesktop
          ? 'border-base-300 bg-base-200 rounded-field mb-2 border'
          : 'composer-bar--mobile bg-base-100',
        dropSurfaceClassName,
        className
      )}>
      <MsgComposer.Context>
        <ComposerContextBars />
      </MsgComposer.Context>

      <AttachmentStrip compact={isMobile} />

      <VoiceRecordingBar
        phase={voice.phase}
        elapsedLabel={voice.elapsedLabel}
        waveformLevels={voice.waveformLevels}
        isCancelArmed={voice.isCancelArmed}
        isLocked={voice.isLocked}
        previewUrl={voice.previewUrl}
        cancelRecording={voice.cancelRecording}
        stopRecording={voice.stopRecording}
        confirmAttach={voice.confirmAttach}
        discardPreview={voice.discardPreview}
      />

      <ComposerFormatPanel variant={variant} />
      <FormattingToolbar variant={variant} />

      <div
        className={twMerge(
          'composer-bar__input-row flex w-full items-center gap-1',
          isDesktop ? 'gap-1.5 px-3 py-2' : 'min-h-11 gap-1 px-3 py-2',
          rowDimmed && 'pointer-events-none opacity-55'
        )}>
        <ComposerInsertMenu
          className="composer-bar__insert-trigger shrink-0"
          showVoiceEntry={canSend}
          onVoiceFromMenu={onVoiceFromMenu}
        />
        <MsgComposer.Input className="min-w-0 flex-1 py-0" />
        <MsgComposer.Actions className={isMobile ? 'gap-0.5' : undefined}>
          <MsgComposer.EmojiButton />
          <ComposerPrimaryAction voice={voice} />
        </MsgComposer.Actions>
      </div>
    </div>
  )
}
