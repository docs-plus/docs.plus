import { useStore } from '@stores'
import { useMessageComposer } from '../../hooks/useMessageComposer'
import MsgComposer from '../../MessageComposer'

/**
 * Mobile-specific toolbar component with animated transitions
 * Shows actions/formatting toolbar based on keyboard state and user preference
 */
const MobileToolbar = () => {
  const { isKeyboardOpen } = useStore((state) => state)
  const { isToolbarOpen, toggleToolbar } = useMessageComposer()

  if (!isKeyboardOpen) return null

  return (
    <div className="relative h-10 overflow-hidden">
      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          isToolbarOpen ? 'translate-y-0' : '-translate-y-full'
        }`}>
        <MsgComposer.Actions>
          <MsgComposer.ToggleToolbarButton />
          <MsgComposer.EmojiButton />
          <MsgComposer.MentionButton />
          <MsgComposer.SendButton />
        </MsgComposer.Actions>
      </div>

      <div
        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
          isToolbarOpen ? 'translate-y-full' : 'translate-y-0'
        }`}>
        <MsgComposer.Toolbar className="bg-base-200 h-full border-b p-2 px-1">
          <MsgComposer.ToggleToolbarButton
            iconType="Close"
            onPress={toggleToolbar}
            size={22}
            className="btn-square !bg-gray-200"
          />
          <div className="divided m-0 w-0" />
          <div className="flex snap-x items-center gap-1 overflow-x-scroll overflow-y-hidden">
            <MsgComposer.BoldButton size={10} className="snap-center" />
            <MsgComposer.ItalicButton size={10} className="snap-center" />
            <MsgComposer.StrikethroughButton size={14} className="snap-center" />
            <MsgComposer.HyperlinkButton size={18} className="snap-center" />
            <MsgComposer.BulletListButton size={16} className="snap-center" />
            <MsgComposer.OrderedListButton size={16} className="snap-center" />
            <MsgComposer.BlockquoteButton size={20} className="snap-center" />
            <MsgComposer.CodeButton size={20} className="snap-center" />
            <MsgComposer.CodeBlockButton size={20} className="snap-center" />
          </div>
        </MsgComposer.Toolbar>
      </div>
    </div>
  )
}

/**
 * Mobile-optimized message composer layout
 *
 * Features:
 * - Touch-friendly interface
 * - Animated toolbar transitions
 * - Compact design for small screens
 * - Keyboard-aware toolbar positioning
 *
 * @example
 * <MessageComposer.MobileLayout />
 */
export const MobileLayout = () => {
  return (
    <div className="chat_editor_container flex w-full flex-col">
      <MsgComposer className="rounded-t-md border border-b-0 border-gray-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <MsgComposer.MobileWrapper>
          <MsgComposer.Context>
            <MsgComposer.ReplyContext />
            <MsgComposer.EditContext />
            <MsgComposer.CommentContext />
          </MsgComposer.Context>

          <div className="flex flex-row items-end gap-2 px-2 py-1.5">
            <MsgComposer.AttachmentButton size={22} className="btn-square bg-gray-200" />
            <MsgComposer.Input className="py-0.5" />
            <MsgComposer.SendButton size={22} className="" />
          </div>
          <MobileToolbar />
        </MsgComposer.MobileWrapper>
      </MsgComposer>
    </div>
  )
}
