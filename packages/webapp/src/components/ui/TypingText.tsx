import { ReactNode, useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface TypingTextItem {
  /** The text content to type */
  text: string
  /** Optional icon to display before text */
  icon?: ReactNode
  /** Optional className for this specific item (e.g., text color) */
  className?: string
}

export interface TypingTextProps {
  /** Array of texts or text items to cycle through */
  texts: (string | TypingTextItem)[]
  /** Typing speed in ms per character */
  typingSpeed?: number
  /** Deleting speed in ms per character */
  deletingSpeed?: number
  /** Delay before starting to delete (ms) */
  delayAfterTyping?: number
  /** Delay before typing next text (ms) */
  delayBeforeTyping?: number
  /** Show blinking cursor */
  showCursor?: boolean
  /** Cursor character */
  cursor?: string
  /** Additional className for container */
  className?: string
  /** Cursor className */
  cursorClassName?: string
  /** Loop through texts infinitely */
  loop?: boolean
  /** Minimum width to prevent layout shift (e.g., '120px', '8rem') */
  minWidth?: string
}

/**
 * TypingText - Animated typing effect component with icon and color support
 *
 * @example
 * // Simple usage
 * <TypingText texts={['Hello', 'World', 'React']} />
 *
 * @example
 * // With icons and colors
 * <TypingText
 *   texts={[
 *     { text: 'teams', icon: <LuUsers size={16} />, className: 'text-blue-600' },
 *     { text: 'communities', icon: <LuGlobe size={16} />, className: 'text-violet-600' },
 *   ]}
 *   minWidth="140px"
 * />
 */
const TypingText = ({
  texts,
  typingSpeed = 100,
  deletingSpeed = 50,
  delayAfterTyping = 2000,
  delayBeforeTyping = 500,
  showCursor = true,
  //cursor = '|',
  className,
  cursorClassName,
  loop = true,
  minWidth
}: TypingTextProps) => {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  const currentItem = texts[textIndex]
  const isObject = typeof currentItem === 'object'
  const currentText = isObject ? currentItem.text : currentItem || ''
  const currentIcon = isObject ? currentItem.icon : null
  const currentClassName = isObject ? currentItem.className : undefined

  const type = useCallback(() => {
    if (isWaiting) return

    if (!isDeleting) {
      // Typing
      if (displayText.length < currentText.length) {
        setDisplayText(currentText.slice(0, displayText.length + 1))
      } else {
        // Finished typing, wait then delete
        setIsWaiting(true)
        setTimeout(() => {
          setIsWaiting(false)
          setIsDeleting(true)
        }, delayAfterTyping)
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        setDisplayText(displayText.slice(0, -1))
      } else {
        // Finished deleting, move to next text
        setIsDeleting(false)
        const nextIndex = textIndex + 1

        if (nextIndex >= texts.length) {
          if (loop) {
            setTextIndex(0)
          }
        } else {
          setTextIndex(nextIndex)
        }

        // Small delay before typing next
        setIsWaiting(true)
        setTimeout(() => {
          setIsWaiting(false)
        }, delayBeforeTyping)
      }
    }
  }, [
    displayText,
    currentText,
    isDeleting,
    isWaiting,
    textIndex,
    texts.length,
    loop,
    delayAfterTyping,
    delayBeforeTyping
  ])

  useEffect(() => {
    const speed = isDeleting ? deletingSpeed : typingSpeed
    const timer = setTimeout(type, speed)
    return () => clearTimeout(timer)
  }, [type, isDeleting, typingSpeed, deletingSpeed])

  // Find the longest text to reserve space
  const longestText = texts.reduce<string>((longest, item) => {
    const text = typeof item === 'string' ? item : item.text
    return text.length > longest.length ? text : longest
  }, '')

  return (
    <span
      className={twMerge('inline-flex items-center', className)}
      style={minWidth ? { minWidth } : undefined}>
      {/* Always reserve space for icon */}
      {currentIcon && (
        <span
          className={twMerge(
            'mr-1.5 flex-shrink-0 transition-opacity duration-150',
            displayText.length > 0 ? 'opacity-100' : 'opacity-0',
            currentClassName
          )}>
          {currentIcon}
        </span>
      )}
      <span className={twMerge('relative inline-block', currentClassName)}>
        {/* Invisible placeholder to reserve width */}
        <span className="invisible whitespace-pre" aria-hidden="true">
          {longestText}
        </span>
        {/* Actual text + cursor overlaid, positioned at start */}
        <span className="absolute inset-0 flex items-center">
          <span>{displayText}</span>
          {showCursor && (
            <span
              className={twMerge(
                'ml-0.5 inline-block w-[2px] animate-pulse bg-current',
                cursorClassName
              )}
              style={{ height: '1.1em' }}
            />
          )}
        </span>
      </span>
    </span>
  )
}

export default TypingText
