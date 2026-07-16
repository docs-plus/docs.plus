import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import { FORMAT_TOOLBAR_FLAT, formatToolbarButtonKey } from '../Toolbar/formatToolbarLayout'

type Props = { variant: keyof ChatroomVariant }

/** Mobile-only compact format grid; desktop uses inline FormattingToolbar. */
export function ComposerFormatPanel({ variant }: Props) {
  const { showFormattingToolbar } = useMessageComposer()

  if (variant !== 'mobile' || !showFormattingToolbar) return null

  return (
    <div
      className={twMerge(
        'composer-bar__format-panel grid grid-cols-5 gap-1 px-2 py-2',
        'motion-safe:animate-[doc-content-in_120ms_ease-out_both]'
      )}>
      {FORMAT_TOOLBAR_FLAT.map((Button, index) => (
        <Button
          key={formatToolbarButtonKey(Button, index)}
          size={18}
          className="btn-ghost rounded-field size-10 min-h-10 min-w-10 shrink-0 border-0 p-0"
          tooltipPosition="top"
        />
      ))}
    </div>
  )
}
