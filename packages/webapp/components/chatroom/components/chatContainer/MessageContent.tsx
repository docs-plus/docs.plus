import React, { useEffect, useState, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { isOnlyEmoji, sanitizeMessageContent, splitEmojis } from '@utils/index'
import { getEmojiDataFromNative } from 'emoji-mart'
import { useAuthStore, useStore } from '@stores'
import { useMentionClick } from '@components/chatroom/hooks'

interface MessageContentProps {
  message: {
    content: string
    html?: string
    user_details: {
      id: string
    }
  }
}

const MessageContent: React.FC<MessageContentProps> = ({ message }) => {
  const user = useAuthStore((state) => state.profile)
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)
  const sanitizedHtml = useMemo(() => {
    if (!message.html) return message.content
    const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(message.html, message.content)
    return sanitizedHtml || sanitizedText || message.content || ''
  }, [message.html, message.content])

  const [emojiTitles, setEmojiTitles] = useState<Record<number, string>>({})
  const [emojiArray, setEmojiArray] = useState<string[]>([])

  const contentIsOnlyEmoji = useMemo(() => {
    const result = isOnlyEmoji(message?.content || '')
    if (result && message?.content) {
      // If it's emoji-only content, prepare the emoji array
      const emojis = splitEmojis(message.content)
      setEmojiArray(emojis || [])
    }
    return result
  }, [message?.content])

  useEffect(() => {
    const loadEmojiTitles = async () => {
      if (!emojiArray.length) return

      const titles: Record<number, string> = {}

      for (let i = 0; i < emojiArray.length; i++) {
        try {
          // Use a timeout to avoid rate limiting
          const emojiData = (await Promise.race([
            getEmojiDataFromNative(emojiArray[i]),
            new Promise((resolve) => setTimeout(() => resolve({ name: 'emoji' }), 500))
          ])) as any

          titles[i] = emojiData?.name || 'emoji'
        } catch (error) {
          console.error(`Error loading emoji data for ${emojiArray[i]}:`, error)
          titles[i] = 'emoji'
        }
      }

      setEmojiTitles(titles)
    }

    if (contentIsOnlyEmoji && emojiArray.length > 0) {
      loadEmojiTitles()
    }
  }, [emojiArray, contentIsOnlyEmoji])

  const handleMentionClick = useMentionClick()

  // Render content based on type
  if (!message?.content) {
    return null
  }

  return (
    <div className="flex flex-col" onClick={handleMentionClick}>
      {contentIsOnlyEmoji ? (
        <div
          className={`flex w-full flex-wrap gap-1 ${message?.user_details?.id === user?.id && isMobile ? 'justify-end' : 'justify-start'}`}>
          {emojiArray.map((emoji: string, index: number) => (
            <div
              key={index}
              className="tooltip tooltip-bottom"
              data-tip={emojiTitles[index] || 'emoji'}>
              {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                <em-emoji native={emoji} set="native" size="4rem"></em-emoji>
              }
            </div>
          ))}
        </div>
      ) : (
        <div
          className="message--card__content prose-slate prose-invert max-w-full overflow-hidden text-wrap break-words whitespace-pre-wrap"
          dir="auto"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
    </div>
  )
}

export default MessageContent
