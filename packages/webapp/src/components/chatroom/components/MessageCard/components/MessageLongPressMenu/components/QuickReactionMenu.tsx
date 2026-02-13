import { useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { motion } from 'motion/react'
import { forwardRef } from 'react'
import { LuPlus } from 'react-icons/lu'

import { useMessageLongPressMenu } from '../MessageLongPressMenu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_REACTIONS: EmojiReaction[] = [
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

/** Shared tap animation for reaction buttons. */
const TAP_ANIMATION = {
  scale: 0.9,
  backgroundColor: 'rgba(0,0,0,0.1)',
  transition: { duration: 0.1 }
}

/** Min 44×44 touch target per WCAG / Apple HIG. */
const REACTION_BTN_CLASS =
  'flex size-11 flex-shrink-0 touch-manipulation snap-center scroll-ml-6 items-center justify-center rounded-full select-none'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const QuickReactionMenu = forwardRef<HTMLDivElement, QuickReactionMenuProps>(
  ({ position, isVisible, isInteractive = true, onReactionSelect, className, message }, ref) => {
    const { openEmojiPicker } = useChatStore()
    const { hideMenu } = useMessageLongPressMenu()

    const handleReactionClick = (reaction: EmojiReaction) => {
      if (!isInteractive) return
      onReactionSelect(reaction.native)
      hideMenu()
    }

    const handleMoreEmojisClick = () => {
      if (!isInteractive) return
      openEmojiPicker({ top: 0, left: 0 }, 'react2Message', message, null)
      hideMenu()
    }

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Quick reactions"
        className={`bg-base-100 overflow-hidden rounded-3xl shadow-lg transition-all duration-200 ease-out ${className ?? ''}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(20px) scale(0.9)',
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
            {QUICK_REACTIONS.map((reaction) => (
              <motion.button
                key={reaction.id}
                onTap={() => handleReactionClick(reaction)}
                whileTap={isInteractive ? TAP_ANIMATION : undefined}
                className={`${REACTION_BTN_CLASS} ${
                  isInteractive
                    ? 'cursor-pointer'
                    : 'pointer-events-none cursor-not-allowed opacity-60'
                }`}
                disabled={!isInteractive}
                aria-label={`React with ${reaction.label}`}
                title={reaction.label}>
                {/* @ts-expect-error – em-emoji is a web component from @emoji-mart */}
                <em-emoji set="native" id={reaction.id} size="1.6em" />
              </motion.button>
            ))}

            {/* "More emojis" button — sticky to right edge */}
            <motion.button
              onTap={handleMoreEmojisClick}
              whileTap={
                isInteractive
                  ? { ...TAP_ANIMATION, backgroundColor: 'rgba(0,0,0,0.15)' }
                  : undefined
              }
              className={`bg-base-200 sticky right-0 flex size-11 touch-manipulation items-center justify-center rounded-full shadow-lg select-none ${
                isInteractive
                  ? 'cursor-pointer'
                  : 'pointer-events-none cursor-not-allowed opacity-60'
              }`}
              disabled={!isInteractive}
              aria-label="More emojis"
              title="More emojis"
              style={{
                boxShadow:
                  '-20px 0 20px -10px rgba(0, 0, 0, 0.15), -10px 0 10px -5px rgba(0, 0, 0, 0.1), -5px 0 5px -2px rgba(0, 0, 0, 0.05)'
              }}>
              <LuPlus
                size={22}
                className={isInteractive ? 'text-base-content/60' : 'text-base-content/40'}
              />
            </motion.button>
          </div>
        </div>
      </div>
    )
  }
)

QuickReactionMenu.displayName = 'QuickReactionMenu'
