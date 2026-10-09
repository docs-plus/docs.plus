import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { CHAT_MEDIA_MAX_ATTACHMENTS } from '@components/chatroom/utils/messageMediaPaths'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { useAuthStore, useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useEffect, useRef } from 'react'

import { registerComposerVoiceDiscard } from '../../helpers/composerVoiceRecording'
import { useComposerAttachmentList } from '../../hooks'
import { useComposerFileDrop } from '../../hooks/useComposerFileDrop'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import { useSendVoiceWhenReady } from '../../hooks/useSendVoiceWhenReady'
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
  const attachments = useComposerAttachmentList(workspaceId, channelId)
  const { dropHandlers, dropSurfaceClassName } = useComposerFileDrop()
  const sendVoiceNote = useSendVoiceWhenReady(attachments)

  const voice = useVoiceRecorder({
    onSend: sendVoiceNote,
    attachmentCount: attachments.length,
    maxAttachments: CHAT_MEDIA_MAX_ATTACHMENTS,
    onAuthRequired: openComposerSignIn,
    userId: user?.id
  })

  const discardVoiceRef = useRef(voice.discard)
  discardVoiceRef.current = voice.discard

  useEffect(() => {
    registerComposerVoiceDiscard(() => discardVoiceRef.current())
    return () => registerComposerVoiceDiscard(null)
  }, [])

  useEffect(() => {
    return () => discardVoiceRef.current()
  }, [])

  // The held mic stays at full strength, so the dim skips it.
  const dim = voice.isHolding && 'opacity-55'

  return (
    <div
      ref={voice.dragSurfaceRef}
      data-chat-composer-surface
      {...dropHandlers}
      className={twMerge(
        // A hold lets the lock pill rise over the feed; overlays that need the clip are closed then.
        'composer-bar flex flex-col',
        voice.isHolding ? 'overflow-visible' : 'overflow-hidden',
        isDesktop
          ? 'border-base-300 bg-base-200 rounded-field mb-2 border'
          : 'composer-bar--mobile border-base-300 bg-base-200 border-t',
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
        liveLevels={voice.liveLevels}
        isCancelArmed={voice.isCancelArmed}
        isLocked={voice.isLocked}
        previewUrl={voice.previewUrl}
        discard={voice.discard}
        stopRecording={voice.stopRecording}
        sendPreview={voice.sendPreview}
      />

      {isDesktop ? <FormattingToolbar /> : <ComposerFormatPanel />}

      <div
        className={twMerge(
          'composer-bar__input-row flex w-full items-center gap-1',
          isDesktop ? 'gap-1.5 px-3 py-2' : 'min-h-11 gap-1 px-3 py-2',
          voice.isHolding && 'pointer-events-none'
        )}>
        <ComposerInsertMenu
          className={twMerge('composer-bar__insert-trigger shrink-0', dim)}
          showVoiceEntry={canSend}
          onVoiceFromMenu={voice.startLockedFromMenu}
        />
        <MsgComposer.Input className={twMerge('min-w-0 flex-1 py-0', dim)} />
        <MsgComposer.Actions className={isMobile ? 'gap-0.5' : undefined}>
          <MsgComposer.EmojiButton className={dim || undefined} />
          <ComposerPrimaryAction voice={voice} />
        </MsgComposer.Actions>
      </div>
    </div>
  )
}
