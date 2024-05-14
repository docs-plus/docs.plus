import React, { useEffect, useState, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { isOnlyEmoji, splitEmojis } from '@utils/index'
import { getEmojiDataFromNative } from 'emoji-mart'
import { useAuthStore } from '@stores'
interface MessageContentProps {
  data: {
    content: string
    html?: string
    user_details: {
      id: string
    }
  }
}

const MessageContent: React.FC<MessageContentProps> = ({ data }) => {
  const user = useAuthStore((state) => state.profile)
  const sanitizedHtml = useMemo(() => {
    return data.html ? DOMPurify.sanitize(data.html) : data.content
  }, [data.html, data.content])

  const [emojiTitles, setEmojiTitles] = useState<Record<number, string>>({})

  const contentIsOnlyEmoji = isOnlyEmoji(data.content)

  useEffect(() => {
    const loadEmojiTitles = async () => {
      const titles: Record<number, string> = {}
      const emojis = splitEmojis(data.content)
      if (emojis) {
        for (let i = 0; i < emojis.length; i++) {
          const emojiData = await getEmojiDataFromNative(emojis[i])
          titles[i] = emojiData.name
        }
      }
      setEmojiTitles(titles)
    }

    if (contentIsOnlyEmoji) loadEmojiTitles()
  }, [data.content, contentIsOnlyEmoji])

  // Check if the content is only emoji outside of JSX for readability.

  return (
    <div className="flex flex-col">
      {contentIsOnlyEmoji ? (
        <div
          className={`flex ${data?.user_details?.id === user?.id ? 'justify-end' : 'justify-start'}`}>
          {splitEmojis(data.content)?.map((emoji: string, index: number) => (
            <div key={index} className="tooltip tooltip-bottom" data-tip={emojiTitles[index]}>
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
          className="message--card__content prose-slate prose-invert text-wrap"
          dir="auto"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
    </div>
  )
}

export default MessageContent
