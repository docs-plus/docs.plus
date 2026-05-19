import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'
import { twMerge } from 'tailwind-merge'

import { useMessageComposer } from '../../hooks/useMessageComposer'
import MsgComposer from '../../MessageComposer'

const DesktopLayoutBody = () => {
  const { contextType } = useMessageComposer()
  const hasContext = contextType != null

  return (
    <div
      data-chat-composer-surface
      className="border-base-300 overflow-hidden rounded-md border bg-transparent shadow-md">
      <MsgComposer.Context>
        <MsgComposer.ReplyContext />
        <MsgComposer.EditContext />
        <MsgComposer.CommentContext />
      </MsgComposer.Context>

      <MsgComposer.Toolbar
        className={twMerge(
          'bg-base-300/60 border-base-100 h-10 border-b p-2 px-1',
          !hasContext && 'rounded-t-md'
        )}>
        <MsgComposer.BoldButton size={16} />
        <MsgComposer.ItalicButton size={16} />
        <MsgComposer.StrikethroughButton size={16} />
        <ToolbarDivider className="self-center" />
        <MsgComposer.HyperlinkButton size={16} />
        <MsgComposer.BulletListButton size={16} />
        <MsgComposer.OrderedListButton size={16} />
        <ToolbarDivider className="self-center" />
        <MsgComposer.BlockquoteButton size={16} />
        <MsgComposer.CodeButton size={16} />
        <MsgComposer.CodeBlockButton size={16} />
      </MsgComposer.Toolbar>

      <MsgComposer.Input />

      <MsgComposer.Actions>
        <MsgComposer.ToggleToolbarButton />
        <MsgComposer.EmojiButton />
        <MsgComposer.MentionButton />
        <MsgComposer.SendButton />
      </MsgComposer.Actions>
    </div>
  )
}

export const DesktopLayout = () => {
  return (
    <MsgComposer className="chat_editor_container m-auto mb-2 flex w-[98%] flex-col">
      <DesktopLayoutBody />
    </MsgComposer>
  )
}
