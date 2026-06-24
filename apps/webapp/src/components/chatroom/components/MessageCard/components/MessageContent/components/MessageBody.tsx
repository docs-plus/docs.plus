import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useMentionClick } from '@components/chatroom/hooks'
import { getSanitizedMessageBodyHtml } from '@utils/index'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import { useMessageCardContext } from '../../../MessageCardContext'
import { EmojiBody } from './EmojiBody'
import { HTMLBody } from './HTMLBody'
import { MessageMediaAttachments } from './MessageMediaAttachments'

export const MessageBody = () => {
  const { message, isEmojiOnlyMessage, medias, messageLayout } = useMessageCardContext()
  const { variant } = useChatroomContext()
  const handleMentionClick = useMentionClick()

  const bodyHtml = useMemo(
    () => getSanitizedMessageBodyHtml(message.html, message.content || ''),
    [message.html, message.content]
  )
  const showBody = isEmojiOnlyMessage || bodyHtml.trim().length > 0
  const isMediaWithCaption = messageLayout === 'media-with-caption'

  return (
    <div
      className={twMerge('flex flex-col', isMediaWithCaption && 'gap-1.5')}
      onClick={handleMentionClick}>
      {medias.length > 0 && <MessageMediaAttachments medias={medias} layout={messageLayout} />}
      {showBody && (
        <div className={twMerge(isMediaWithCaption && variant === 'mobile' && 'px-2.5 pt-0.5')}>
          {isEmojiOnlyMessage ? <EmojiBody /> : <HTMLBody />}
        </div>
      )}
    </div>
  )
}
