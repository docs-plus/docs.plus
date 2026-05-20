import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'
import { useStore } from '@stores'
import { type ComponentType, Fragment } from 'react'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import MsgComposer from '../../MessageComposer'
import {
  BlockquoteButton,
  BoldButton,
  BulletListButton,
  CodeBlockButton,
  CodeButton,
  HyperlinkButton,
  ItalicButton,
  OrderedListButton,
  StrikethroughButton
} from '../Toolbar/ToolbarButtons'

type Props = { variant: keyof ChatroomVariant }

type FormatButtonProps = { size: number; className?: string }

const TOOLBAR_CLASS = 'border-base-300/80 bg-base-200 flex h-10 items-center gap-1 border-b px-3'
const BTN_SIZE = 16
const MOBILE_BTN_CLASS = 'h-8 min-w-8 shrink-0'

const FORMAT_GROUPS: ComponentType<FormatButtonProps>[][] = [
  [BoldButton, ItalicButton, StrikethroughButton],
  [HyperlinkButton, BulletListButton, OrderedListButton],
  [BlockquoteButton, CodeButton, CodeBlockButton]
]

function formatButtonKey(Button: ComponentType<FormatButtonProps>, index: number) {
  return Button.displayName ?? Button.name ?? `format-${index}`
}

function FormatButtons({ className }: { className?: string }) {
  return (
    <>
      {FORMAT_GROUPS.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 ? <ToolbarDivider className="self-center" /> : null}
          {group.map((Button, index) => (
            <Button key={formatButtonKey(Button, index)} size={BTN_SIZE} className={className} />
          ))}
        </Fragment>
      ))}
    </>
  )
}

export function FormattingToolbar({ variant }: Props) {
  const { showFormattingToolbar } = useMessageComposer()
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)

  if (!showFormattingToolbar) return null
  if (variant === 'mobile' && !isKeyboardOpen) return null

  if (variant === 'mobile') {
    return (
      <MsgComposer.Toolbar className={TOOLBAR_CLASS}>
        <div className="hide-scrollbar flex flex-1 snap-x snap-mandatory items-center gap-2 overflow-x-auto">
          {FORMAT_GROUPS.flat().map((Button, index) => (
            <Button
              key={formatButtonKey(Button, index)}
              size={BTN_SIZE}
              className={MOBILE_BTN_CLASS}
            />
          ))}
        </div>
      </MsgComposer.Toolbar>
    )
  }

  return (
    <MsgComposer.Toolbar className={TOOLBAR_CLASS}>
      <FormatButtons />
    </MsgComposer.Toolbar>
  )
}
