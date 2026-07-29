import { prefersReducedMotion } from '@utils/motion'
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

const TypingText = ({
  texts,
  typingSpeed = 100,
  deletingSpeed = 50,
  delayAfterTyping = 2000,
  delayBeforeTyping = 500,
  showCursor = true,
  className,
  cursorClassName,
  loop = true,
  minWidth
}: TypingTextProps) => {
  const resolveText = (item: string | TypingTextItem) =>
    typeof item === 'object' ? item.text : item

  const staticFirstText = texts.length > 0 ? resolveText(texts[0]) : ''
  const [mounted, setMounted] = useState(false)
  const [displayText, setDisplayText] = useState(staticFirstText)
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  // Post-hydration read (SSR-safe): under reduced motion the loop never runs and
  // the first text renders statically.
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setMounted(true)
    setReducedMotion(prefersReducedMotion())
    if (!prefersReducedMotion()) {
      setDisplayText('')
    }
  }, [])

  const currentItem = texts[textIndex]
  const isObject = typeof currentItem === 'object'
  const currentText = isObject ? currentItem.text : currentItem || ''
  const currentIcon = isObject ? currentItem.icon : null
  const currentClassName = isObject ? currentItem.className : undefined

  const type = useCallback(() => {
    if (isWaiting) return

    if (!isDeleting) {
      if (displayText.length < currentText.length) {
        setDisplayText(currentText.slice(0, displayText.length + 1))
      } else {
        setIsWaiting(true)
        setTimeout(() => {
          setIsWaiting(false)
          setIsDeleting(true)
        }, delayAfterTyping)
      }
    } else {
      if (displayText.length > 0) {
        setDisplayText(displayText.slice(0, -1))
      } else {
        setIsDeleting(false)
        const nextIndex = textIndex + 1

        if (nextIndex >= texts.length) {
          if (loop) {
            setTextIndex(0)
          }
        } else {
          setTextIndex(nextIndex)
        }

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
    if (!mounted || reducedMotion) {
      if (reducedMotion) setDisplayText(currentText)
      return
    }
    const speed = isDeleting ? deletingSpeed : typingSpeed
    const timer = setTimeout(type, speed)
    return () => clearTimeout(timer)
  }, [mounted, type, isDeleting, typingSpeed, deletingSpeed, reducedMotion, currentText])

  // Reserve width for the longest text so cycling never shifts layout.
  const longestText = texts.reduce<string>((longest, item) => {
    const text = typeof item === 'string' ? item : item.text
    return text.length > longest.length ? text : longest
  }, '')

  return (
    <span
      className={twMerge('inline-flex items-center', className)}
      style={minWidth ? { minWidth } : undefined}>
      {/* Fades rather than unmounts, so the icon's space stays reserved */}
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
        <span className="absolute inset-0 flex items-center">
          <span>{displayText}</span>
          {showCursor && !reducedMotion && (
            <span
              className={twMerge(
                'ml-0.5 inline-block w-[2px] bg-current motion-safe:animate-pulse',
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
