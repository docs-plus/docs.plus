import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'
import useReRenderOnEditorTransaction from '@hooks/useReRenderOnEditorTransaction'
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

const FORMAT_GROUPS: ComponentType<FormatButtonProps>[][] = [
  [BoldButton, ItalicButton, StrikethroughButton],
  [HyperlinkButton, BulletListButton, OrderedListButton],
  [BlockquoteButton, CodeButton, CodeBlockButton]
]

function formatButtonKey(Button: ComponentType<FormatButtonProps>, index: number) {
  return Button.displayName ?? Button.name ?? `format-${index}`
}

function FormatButtonGroups() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      {FORMAT_GROUPS.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && <ToolbarDivider className="mx-1 h-5 w-px shrink-0 self-center" />}
          <div className="flex items-center gap-0.5">
            {group.map((Button, index) => (
              <Button
                key={formatButtonKey(Button, index)}
                size={18}
                className="btn-ghost size-8 min-h-8 min-w-8 shrink-0 rounded-md border-0 p-0"
              />
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export function FormattingToolbar({ variant }: Props) {
  const { showFormattingToolbar, editor } = useMessageComposer()
  useReRenderOnEditorTransaction(editor ?? null)

  if (!showFormattingToolbar) return null

  return (
    <MsgComposer.Toolbar className="composer-bar__format-toolbar border-base-300/80 bg-base-200 flex min-h-9 w-full items-center gap-0.5 border-b px-2 py-1 sm:min-h-10 sm:px-3">
      {variant === 'mobile' ? (
        <div className="hide-scrollbar flex flex-1 snap-x snap-mandatory items-center gap-1 overflow-x-auto">
          {FORMAT_GROUPS.flat().map((Button, index) => (
            <Button
              key={formatButtonKey(Button, index)}
              size={18}
              className="btn-ghost size-8 min-h-8 min-w-8 shrink-0 rounded-md border-0 p-0"
            />
          ))}
        </div>
      ) : (
        <FormatButtonGroups />
      )}
    </MsgComposer.Toolbar>
  )
}
