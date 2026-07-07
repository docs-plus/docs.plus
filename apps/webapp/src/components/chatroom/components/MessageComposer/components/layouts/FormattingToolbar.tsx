import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'
import useReRenderOnEditorTransaction from '@hooks/useReRenderOnEditorTransaction'
import { Fragment } from 'react'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import MsgComposer from '../../MessageComposer'
import { FORMAT_TOOLBAR_GROUPS, formatToolbarButtonKey } from '../Toolbar/formatToolbarLayout'

type Props = { variant: keyof ChatroomVariant }

function FormatButtonGroups() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      {FORMAT_TOOLBAR_GROUPS.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && <ToolbarDivider className="mx-1 h-5 w-px shrink-0 self-center" />}
          <div className="flex items-center gap-0.5">
            {group.map((Button, index) => (
              <Button
                key={formatToolbarButtonKey(Button, index)}
                size={18}
                className="btn-ghost rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0"
                tooltipPosition="top"
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

  if (!showFormattingToolbar || variant === 'mobile') return null

  return (
    <MsgComposer.Toolbar className="composer-bar__format-toolbar border-base-300 bg-base-200 flex min-h-9 w-full items-center gap-0.5 border-b px-2 py-1 sm:min-h-10 sm:px-3">
      <FormatButtonGroups />
    </MsgComposer.Toolbar>
  )
}
