import { emojiReaction } from '@api'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import { useChatStore } from '@stores'
import { useCallback } from 'react'

const MessageReactionSheet = () => {
  const handleSelect = useCallback((native: string) => {
    const chat = useChatStore.getState()
    emojiReaction(chat.emojiPicker.selectedMessage, native)
    chat.closeEmojiPicker()
  }, [])

  return (
    <EmojiPanel variant="mobile" onSelect={handleSelect}>
      <EmojiPanel.Selector />
    </EmojiPanel>
  )
}

export default MessageReactionSheet
