import { useState, useEffect, useCallback, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface FlipWordItem {
  /** The text content to display */
  text: string
  /** Optional icon to display before text */
  icon?: ReactNode
  /** Optional className for this specific item */
  className?: string
}

export interface FlipWordsProps {
  /** Array of words/items to flip through */
  words: (string | FlipWordItem)[]
  /** Duration each word is shown (ms) */
  duration?: number
  /** Additional className for the container */
  className?: string
  /** ClassName for each word item */
  itemClassName?: string
}

/**
 * FlipWords - Animated text rotation component
 *
 * @example
 * // Simple usage with strings
 * <FlipWords words={['teams', 'communities', 'projects']} />
 *
 * @example
 * // With icons and custom styling
 * <FlipWords
 *   words={[
 *     { text: 'teams', icon: <LuUsers size={16} />, className: 'bg-blue-50 text-blue-600' },
 *     { text: 'communities', icon: <LuGlobe size={16} />, className: 'bg-violet-50 text-violet-600' },
 *   ]}
 *   duration={3000}
 *   className="h-8"
 *   itemClassName="rounded-full px-3"
 * />
 */
const FlipWords = ({
  words,
  duration = 2500,
  className,
  itemClassName
}: FlipWordsProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const nextWord = useCallback(() => {
    setIsAnimating(true)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length)
      setIsAnimating(false)
    }, 300) // Animation duration
  }, [words.length])

  useEffect(() => {
    const interval = setInterval(nextWord, duration)
    return () => clearInterval(interval)
  }, [duration, nextWord])

  const currentWord = words[currentIndex]
  const isObject = typeof currentWord === 'object'
  const text = isObject ? currentWord.text : currentWord
  const icon = isObject ? currentWord.icon : null
  const itemClass = isObject ? currentWord.className : undefined

  return (
    <span
      className={twMerge(
        'inline-flex items-center justify-center overflow-hidden',
        className
      )}>
      <span
        className={twMerge(
          'inline-flex items-center gap-1.5 transition-all duration-300',
          isAnimating ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100',
          itemClassName,
          itemClass
        )}>
        {icon}
        {text}
      </span>
    </span>
  )
}

export default FlipWords
