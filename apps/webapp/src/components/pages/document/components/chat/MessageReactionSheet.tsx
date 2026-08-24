import { emojiReaction } from '@api'
import { EmojiPanel } from '@components/chatroom/components/EmojiPanel'
import { closeMessageReaction } from '@components/chatroom/utils/messageReaction'
import { SheetLayout } from '@components/SheetLayout'
import { useChatStore } from '@stores'
import { useCallback } from 'react'

const MessageReactionSheet = () => {
  const handleSelect = useCallback((native: string) => {
    const chat = useChatStore.getState()
    emojiReaction(chat.emojiPicker.selectedMessage, native)
    closeMessageReaction()
  }, [])

  return (
    <SheetLayout title="React" onClose={closeMessageReaction}>
      <EmojiPanel variant="mobile" onSelect={handleSelect}>
        <EmojiPanel.Selector />
      </EmojiPanel>
    </SheetLayout>
  )
}

export default MessageReactionSheet
