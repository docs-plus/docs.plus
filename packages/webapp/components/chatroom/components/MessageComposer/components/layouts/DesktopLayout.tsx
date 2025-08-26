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
      <div className="rounded-md border border-gray-300 bg-transparent shadow-md">
        <MsgComposer.Toolbar className="bg-base-300/60 h-10 rounded-t-md border-b p-2 px-1">
          <MsgComposer.BoldButton size={10} />
          <MsgComposer.ItalicButton size={10} />
          <MsgComposer.StrikethroughButton size={14} />
          <div className="divided" />
          <MsgComposer.HyperlinkButton size={18} />
          <MsgComposer.BulletListButton size={16} />
          <MsgComposer.OrderedListButton size={16} />
          <div className="divided" />
          <MsgComposer.BlockquoteButton size={20} />
          <MsgComposer.CodeButton size={20} />
          <MsgComposer.CodeBlockButton size={20} />
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
