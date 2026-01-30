import type { AvatarSize } from '@components/ui/Avatar'
import { twMerge } from 'tailwind-merge'

interface AvatarStackLoaderProps {
  /** Additional classes for the container */
  className?: string
  /** Avatar size preset */
  size?: AvatarSize
  /** Number of skeleton avatars to show */
  repeat?: number
}

/**
 * Size classes matching Avatar component
 */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14',
  '2xl': 'size-16'
}

/**
 * Negative spacing for avatar overlap based on size
 */
const SPACING_CLASSES: Record<AvatarSize, string> = {
  xs: '-space-x-2',
  sm: '-space-x-3',
  md: '-space-x-4',
  lg: '-space-x-5',
  xl: '-space-x-6',
  '2xl': '-space-x-7'
}

/**
 * Loading skeleton for AvatarStack
 *
 * Displays placeholder avatars while data is loading.
 * Matches the visual style of AvatarStack.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AvatarStackLoader />
 *
 * // Custom size and count
 * <AvatarStackLoader size="lg" repeat={3} />
 * ```
 */
const AvatarStackLoader = ({ className = '', size = 'md', repeat = 2 }: AvatarStackLoaderProps) => {
  const sizeClass = SIZE_CLASSES[size]
  const spacingClass = SPACING_CLASSES[size]

  return (
    <div className={twMerge('avatar-group', spacingClass, className)}>
      {Array.from({ length: repeat }).map((_, index) => (
        <div className="avatar" key={index}>
          <div
            className={twMerge(
              sizeClass,
              'skeleton rounded-full',
              'border-2 border-white',
              'ring-2 ring-white'
            )}
          />
        </div>
      ))}
    </div>
  )
}

export default AvatarStackLoader
