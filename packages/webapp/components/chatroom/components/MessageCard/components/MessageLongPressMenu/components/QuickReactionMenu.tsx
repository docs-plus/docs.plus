import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { MdAdd } from 'react-icons/md'
import { useSheetStore, useChatStore } from '@stores'
import { useMessageLongPressMenu } from '../MessageLongPressMenu'
import { TMsgRow } from '@types'

interface EmojiReaction {
  id: string
  label: string
  native: string
}

interface QuickReactionMenuProps {
  position: { x: number; y: number }
  isVisible: boolean
  isInteractive?: boolean
  onReactionSelect: (nativeEmoji: string) => void
  className?: string
  message: TMsgRow
}

const availableEmojiReactions: EmojiReaction[] = [
  { id: '+1', label: 'Like', native: '👍' },
  { id: 'heart', label: 'Love', native: '❤️' },
  { id: 'joy', label: 'Laugh', native: '😂' },
  { id: 'open_mouth', label: 'Wow', native: '😮' },
  { id: 'cry', label: 'Sad', native: '😢' },
  { id: 'rage', label: 'Angry', native: '😡' },
  { id: 'pray', label: 'Pray', native: '🙏' },
  { id: 'melting_face', label: 'Melting Face', native: '🫠' },
  { id: 'clap', label: 'Clap', native: '👏' },
  { id: 'pleading_face', label: 'Face Holding Back Tear', native: '🥺' },
  { id: 'sob', label: 'Sob', native: '😭' }
]

export const QuickReactionMenu = forwardRef<HTMLDivElement, QuickReactionMenuProps>(
  ({ position, isVisible, isInteractive = true, onReactionSelect, className, message }, ref) => {
    const { switchSheet } = useSheetStore()
    const { openEmojiPicker } = useChatStore()
    const { hideMenu } = useMessageLongPressMenu()
    const handleReactionClick = (reaction: EmojiReaction) => {
      if (!isInteractive) return
      onReactionSelect(reaction.native) // Pass native emoji instead of ID
      hideMenu()
    }

    const handleMoreEmojisClick = () => {
      if (!isInteractive) return
      // TODO: Open full emoji picker
      console.log('Open full emoji picker')
      // switchSheet('emojiPicker', {
      //   chatRoomState: { ...chatRoom }
      // })
      openEmojiPicker({ top: 0, left: 0 }, 'react2Message', message, null)
      hideMenu()
    }

    return (
      <div
        ref={ref}
        className={`overflow-hidden rounded-3xl bg-white shadow-lg transition-all duration-200 ease-out ${className || ''}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(-10px) scale(0.9)',
          opacity: isVisible ? 1 : 0,
          maxWidth: '380px',
          width: '88%',
          zIndex: 70
        }}
        onClick={(e) => e.stopPropagation()}>
        <div
          className="scrollbar-hide flex snap-x snap-mandatory items-center gap-1 overflow-x-auto scroll-smooth p-1.5"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
          <div className="flex">
            {availableEmojiReactions.map((reactionOption) => (
              <motion.button
                key={reactionOption.id}
                onTap={() => {
                  if (!isInteractive) return
                  handleReactionClick(reactionOption)
                }}
                whileTap={{
                  scale: 0.9,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  transition: { duration: 0.1 }
                }}
                className={`flex size-10 flex-shrink-0 touch-manipulation snap-center scroll-ml-6 items-center justify-center rounded-full ${
                  isInteractive
                    ? 'cursor-pointer select-none'
                    : 'pointer-events-none cursor-not-allowed opacity-60'
                }`}
                disabled={!isInteractive}
                title={reactionOption.label}>
                {/* @ts-ignore */}
                <em-emoji set="native" id={reactionOption.id} size="1.6em"></em-emoji>
              </motion.button>
            ))}
            <motion.button
              onTap={() => {
                if (!isInteractive) return
                handleMoreEmojisClick()
              }}
              whileTap={{
                scale: 0.9,
                backgroundColor: 'rgba(0,0,0,0.15)',
                transition: { duration: 0.1 }
              }}
              className={`sticky right-0 flex size-10 touch-manipulation items-center justify-center rounded-full bg-gray-200 shadow-lg select-none ${
                isInteractive
                  ? 'cursor-pointer'
                  : 'pointer-events-none cursor-not-allowed opacity-60'
              }`}
              disabled={!isInteractive}
              title="More emojis"
              style={{
                boxShadow:
                  '-20px 0 20px -10px rgba(0, 0, 0, 0.15), -10px 0 10px -5px rgba(0, 0, 0, 0.1), -5px 0 5px -2px rgba(0, 0, 0, 0.05)'
              }}>
              <MdAdd size={26} className={`${isInteractive ? 'text-gray-600' : 'text-gray-400'}`} />
            </motion.button>
          </div>
        </div>
      </div>
    )
  }
)

QuickReactionMenu.displayName = 'QuickReactionMenu'
