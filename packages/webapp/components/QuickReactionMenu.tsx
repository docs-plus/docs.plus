import { useRef, forwardRef } from 'react'
import { MdAdd } from 'react-icons/md'

interface EmojiReaction {
  id: string
  label: string
}

interface QuickReactionMenuProps {
  position: { x: number; y: number }
  isVisible: boolean
  onReactionSelect: (reactionId: string) => void
  onClose: () => void
  className?: string
}

const availableEmojiReactions: EmojiReaction[] = [
  { id: '+1', label: 'Like' },
  { id: 'heart', label: 'Love' },
  { id: 'joy', label: 'Laugh' },
  { id: 'open_mouth', label: 'Wow' },
  { id: 'cry', label: 'Sad' },
  { id: 'rage', label: 'Angry' },
  { id: 'pray', label: 'Pray' },
  { id: 'melting_face', label: 'Melting Face' },
  { id: 'clap', label: 'Clap' },
  { id: 'pleading_face', label: 'Face Holding Back Tear' },
  { id: 'sob', label: 'Sob' }
]

export const QuickReactionMenu = forwardRef<HTMLDivElement, QuickReactionMenuProps>(
  ({ position, isVisible, onReactionSelect, onClose, className }, ref) => {
    const handleReactionClick = (reactionId: string) => {
      onReactionSelect(reactionId)
      onClose()
    }

    const handleMoreEmojisClick = () => {
      // TODO: Open full emoji picker
      console.log('Open full emoji picker')
    }

    return (
      <div
        ref={ref}
        className={`rounded-4xl bg-white shadow-lg transition-all duration-200 ease-out ${className || ''}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(-10px) scale(0.9)',
          opacity: isVisible ? 1 : 0,
          maxWidth: '400px',
          width: '88%',
          zIndex: 70
        }}
        onClick={(e) => e.stopPropagation()}>
        <div
          className="scrollbar-hide flex snap-x snap-mandatory items-center gap-1 overflow-x-auto scroll-smooth px-3 py-2"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
          <div className="flex flex-1">
            {availableEmojiReactions.map((reactionOption) => (
              <button
                key={reactionOption.id}
                className="flex size-10 flex-shrink-0 snap-center items-center justify-center rounded-full transition-all duration-150 hover:scale-110 hover:bg-gray-100 active:scale-95"
                onClick={() => handleReactionClick(reactionOption.id)}
                title={reactionOption.label}>
                {/* @ts-ignore */}
                <em-emoji set="native" id={reactionOption.id} size="1.6em"></em-emoji>
              </button>
            ))}
          </div>

          <button
            className="sticky right-0 flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 transition-all duration-150 hover:bg-gray-400 active:scale-95"
            onClick={handleMoreEmojisClick}
            title="More emojis">
            <MdAdd size={24} className="text-gray-600" />
          </button>
        </div>
      </div>
    )
  }
)

QuickReactionMenu.displayName = 'QuickReactionMenu'
