import { useCallback,useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg'
}

// Consistent colors based on string hash
const AVATAR_COLORS = [
  'bg-primary text-primary-content',
  'bg-secondary text-secondary-content',
  'bg-accent text-accent-content',
  'bg-info text-info-content',
  'bg-success text-success-content',
  'bg-warning text-warning-content'
]

function getColorFromString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitial(name: string | null | undefined): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

function buildStorageUrl(userId: string, avatarUpdatedAt: string | number): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  const timestamp =
    typeof avatarUpdatedAt === 'string' ? new Date(avatarUpdatedAt).getTime() : avatarUpdatedAt
  return `${supabaseUrl}/storage/v1/object/user_avatars/public/${userId}.png?${timestamp}`
}

export interface AvatarProps {
  /** User ID for constructing storage URL */
  userId?: string | null
  /** Timestamp for cache-busting avatar URL */
  avatarUpdatedAt?: string | number | null
  /** Direct image source URL (fallback if storage URL fails) */
  src?: string | null
  /** Name for generating initial letter fallback */
  name?: string | null
  /** Email for generating initial letter fallback (used if no name) */
  email?: string | null
  /** Alt text for image */
  alt?: string
  /** Preset size following design system */
  size?: AvatarSize
  /** Additional classes for the container */
  className?: string
}

/**
 * Avatar component for the admin dashboard
 *
 * Uses the same URL construction strategy as the main webapp with proper fallback chain:
 * 1. If userId + avatarUpdatedAt → try storage bucket URL
 * 2. If storage fails OR no avatarUpdatedAt → try src (avatar_url)
 * 3. If all images fail → show initial letter with consistent color
 *
 * @example
 * ```tsx
 * // From user with avatar_updated_at (will try storage first, then fall back to src)
 * <Avatar userId={user.id} avatarUpdatedAt={user.avatar_updated_at} src={user.avatar_url} name={user.username} />
 *
 * // From pre-constructed URL only
 * <Avatar src={avatarUrl} name="John Doe" />
 *
 * // Just initials
 * <Avatar name="John Doe" size="lg" />
 * ```
 */
export function Avatar({
  userId,
  avatarUpdatedAt,
  src,
  name,
  email,
  alt,
  size = 'sm',
  className
}: AvatarProps) {
  // Track which sources have failed: 0 = trying storage, 1 = trying src, 2 = all failed
  const [failedSources, setFailedSources] = useState(0)

  const displayName = name || email?.split('@')[0] || null
  const initial = getInitial(displayName)
  const colorClass = getColorFromString(userId || displayName || 'default')
  const sizeClass = SIZE_CLASSES[size]

  // Build list of image sources to try in order
  const imageSources = useMemo(() => {
    const sources: string[] = []

    // Priority 1: Storage bucket URL (if we have userId and avatarUpdatedAt)
    if (userId && avatarUpdatedAt) {
      const storageUrl = buildStorageUrl(userId, avatarUpdatedAt)
      if (storageUrl) sources.push(storageUrl)
    }

    // Priority 2: Direct src (avatar_url from OAuth, etc.)
    if (src) sources.push(src)

    return sources
  }, [userId, avatarUpdatedAt, src])

  // Current image source based on how many have failed
  const currentSrc = imageSources[failedSources] || null

  const handleError = useCallback(() => {
    setFailedSources((prev) => prev + 1)
  }, [])

  const containerClass = twMerge(
    'rounded-full flex items-center justify-center font-medium shrink-0',
    sizeClass,
    className
  )

  // Show image if we have a valid source
  if (currentSrc) {
    return (
      <img
        src={currentSrc}
        alt={alt || displayName || 'Avatar'}
        className={twMerge(containerClass, 'object-cover')}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    )
  }

  // Fallback to initial letter
  return <div className={twMerge(containerClass, colorClass)}>{initial}</div>
}
