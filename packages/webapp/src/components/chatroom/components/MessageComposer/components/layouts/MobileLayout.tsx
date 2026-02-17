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
        <MsgComposer.Toolbar className="bg-base-200 h-full border-b p-2">
          <MsgComposer.ToggleToolbarButton
            iconType="Close"
            onPress={toggleToolbar}
            size={16}
            className="btn-square !bg-base-200 shrink-0"
          />
          <div className="bg-base-300 mx-2 h-6 w-px shrink-0" />
          <div className="flex-1 overflow-hidden">
            <div
              className="hide-scrollbar -mb-1 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto overflow-y-hidden scroll-smooth pb-1"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
              <div className="flex snap-start items-center gap-1">
                <MsgComposer.BoldButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.ItalicButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.StrikethroughButton size={16} className="h-8 min-w-[32px] shrink-0" />
              </div>
              <div className="flex snap-start items-center gap-1">
                <MsgComposer.HyperlinkButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.BulletListButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.OrderedListButton size={16} className="h-8 min-w-[32px] shrink-0" />
              </div>
              <div className="flex snap-start items-center gap-1">
                <MsgComposer.BlockquoteButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.CodeButton size={16} className="h-8 min-w-[32px] shrink-0" />
                <MsgComposer.CodeBlockButton size={16} className="h-8 min-w-[32px] shrink-0" />
              </div>
            </div>
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
      <MsgComposer className="border-base-300 rounded-t-md border border-b-0 shadow-sm">
        <MsgComposer.MobileWrapper>
          <MsgComposer.Context>
            <MsgComposer.ReplyContext />
            <MsgComposer.EditContext />
            <MsgComposer.CommentContext />
          </MsgComposer.Context>

          <div className="flex flex-row items-end gap-2 px-2 py-1.5">
            <MsgComposer.AttachmentButton size={20} className="btn-square bg-base-200" />
            <MsgComposer.Input className="py-0.5" />
          </div>
          <MobileToolbar />
        </MsgComposer.MobileWrapper>
      </MsgComposer>
    </div>
  )
}
