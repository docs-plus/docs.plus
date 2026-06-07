import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

import MsgComposer from '../../MessageComposer'
import { ComposerContextBars } from '../Context/ComposerContextBars'
import { FormattingToolbar } from './FormattingToolbar'

type Props = {
  variant: keyof ChatroomVariant
  className?: string
}

export function ComposerBar({ variant, className }: Props) {
  const isDesktop = variant === 'desktop'

  return (
    <div
      data-chat-composer-surface
      className={twMerge(
        'composer-bar border-base-300/80 bg-base-200 flex flex-col overflow-hidden border',
        isDesktop ? 'mb-2 rounded-lg' : 'rounded-t-xl border-b-0',
        className
      )}>
      <MsgComposer.Context>
        <ComposerContextBars />
      </MsgComposer.Context>

      <FormattingToolbar variant={variant} />

      <div
        className={twMerge(
          'composer-bar__input-row flex w-full items-end gap-1.5 px-3',
          isDesktop ? 'py-2' : 'py-1.5'
        )}>
        <MsgComposer.ToggleToolbarButton className="composer-bar__format-toggle shrink-0" />
        <MsgComposer.Input className="min-w-0 flex-1 py-0" />
        <MsgComposer.Actions>
          <MsgComposer.EmojiButton />
          <MsgComposer.MentionButton />
          <MsgComposer.SendButton />
        </MsgComposer.Actions>
      </div>
    </div>
  )
}
