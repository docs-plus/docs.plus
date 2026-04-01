import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'

import MsgComposer from '../../MessageComposer'

/**
 * Desktop-optimized message composer layout
 *
 * Features:
 * - Full-featured toolbar with all formatting options
 * - Larger input area for comfortable typing
 * - Professional desktop-style interface
 * - Optimized for mouse and keyboard interaction
 *
 * @example
 * <MessageComposer.DesktopLayout />
 */
export const DesktopLayout = () => {
  return (
    <MsgComposer className="chat_editor_container m-auto mb-2 flex w-[98%] flex-col">
      <MsgComposer.Context>
        <MsgComposer.ReplyContext />
        <MsgComposer.EditContext />
        <MsgComposer.CommentContext />
      </MsgComposer.Context>
      <div className="border-base-300 rounded-md border bg-transparent shadow-md">
        <MsgComposer.Toolbar className="bg-base-300/60 border-base-100 h-10 rounded-t-md border-b p-2 px-1">
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
    </MsgComposer>
  )
}
