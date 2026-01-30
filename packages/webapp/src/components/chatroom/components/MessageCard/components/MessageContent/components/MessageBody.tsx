import { useMentionClick } from '@components/chatroom/hooks'

import { useMessageCardContext } from '../../../MessageCardContext'
import { EmojiBody } from './EmojiBody'
import { HTMLBody } from './HTMLBody'

export const MessageBody = () => {
  const { isEmojiOnlyMessage } = useMessageCardContext()

  const handleMentionClick = useMentionClick()

  return (
    <div className="flex flex-col" onClick={handleMentionClick}>
      {isEmojiOnlyMessage ? <EmojiBody /> : <HTMLBody />}
    </div>
  )
}
