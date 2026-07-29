import { useComposerEmojiPanelStore } from '@components/chatroom/components/MessageComposer/stores/composerEmojiPanelStore'
import { useChatStore } from '@stores'
import type { ChatPaneMode } from '@types'

/**
 * The stored mode is the reader's intent; this is what gets rendered. The composer
 * emoji panel opens at roughly a keyboard's height and cannot fit inside `half`, so
 * it promotes the pane while open. Deriving rather than writing means the reader's
 * mode survives untouched, so dismissing the panel restores it with no bookkeeping.
 */
export const useChatPaneMode = (): ChatPaneMode => {
  const stored = useChatStore((state) => state.chatRoom.paneMode)
  const emojiPanelOpen = useComposerEmojiPanelStore((state) => state.isOpen)

  return stored !== 'closed' && emojiPanelOpen ? 'expanded' : stored
}
