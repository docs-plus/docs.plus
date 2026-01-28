import { useMessageCardContext } from '../../../MessageCardContext'
import { useEffect, useMemo, useState } from 'react'
import { isOnlyEmoji, splitEmojis } from '@utils/index'
import { getEmojiDataFromNative } from 'emoji-mart'

export const EmojiBody = () => {
  const { message } = useMessageCardContext()
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

  return (
    <div className={`flex w-full flex-wrap gap-1`}>
      {emojiArray.map((emoji: string, index: number) => (
        <div key={index} className="tooltip tooltip-right" data-tip={emojiTitles[index] || 'emoji'}>
          {
            // @ts-ignore
            <em-emoji native={emoji} set="native" size="4rem"></em-emoji>
          }
        </div>
      ))}
    </div>
  )
}
