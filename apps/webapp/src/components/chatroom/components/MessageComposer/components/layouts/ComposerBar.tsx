import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

import { useComposerFileDrop } from '../../hooks/useComposerFileDrop'
import MsgComposer from '../../MessageComposer'
import { AttachButton } from '../Actions/ActionButtons/AttachButton'
import { GifPickerButton } from '../Actions/ActionButtons/GifPickerButton'
import { VoiceNoteButton } from '../Actions/ActionButtons/VoiceNoteButton'
import { AttachmentStrip } from '../Attachments/AttachmentStrip'
import { ComposerContextBars } from '../Context/ComposerContextBars'
import { FormattingToolbar } from './FormattingToolbar'

type Props = {
  variant: keyof ChatroomVariant
  className?: string
}

export function ComposerBar({ variant, className }: Props) {
  const isDesktop = variant === 'desktop'
  const { dropHandlers, dropSurfaceClassName } = useComposerFileDrop()

  return (
    <div
      data-chat-composer-surface
      {...dropHandlers}
      className={twMerge(
        'composer-bar border-base-300/80 bg-base-200 flex flex-col overflow-hidden border',
        isDesktop ? 'mb-2 rounded-lg' : 'rounded-t-xl border-b-0',
        dropSurfaceClassName,
        className
      )}>
      <MsgComposer.Context>
        <ComposerContextBars />
      </MsgComposer.Context>

      <AttachmentStrip />

      <FormattingToolbar variant={variant} />

      <div
        className={twMerge(
          'composer-bar__input-row flex w-full items-end gap-1.5 px-3',
          isDesktop ? 'py-2' : 'py-1.5'
        )}>
        <MsgComposer.ToggleToolbarButton className="composer-bar__format-toggle shrink-0" />
        <MsgComposer.Input className="min-w-0 flex-1 py-0" />
        <MsgComposer.Actions>
          <AttachButton />
          <GifPickerButton />
          <VoiceNoteButton />
          <MsgComposer.EmojiButton />
          <MsgComposer.MentionButton />
          <MsgComposer.SendButton />
        </MsgComposer.Actions>
      </div>
    </div>
  )
}
