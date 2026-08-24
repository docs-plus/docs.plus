import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg'
}

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
  userId?: string | null
  avatarUpdatedAt?: string | number | null
  src?: string | null
  name?: string | null
  email?: string | null
  alt?: string
  size?: AvatarSize
  className?: string
}

/**
 * Resolves an avatar through a storage → src → initial-letter fallback chain. A custom
 * upload (userId + avatarUpdatedAt) builds the storage bucket URL. Otherwise it uses
 * `src` (the OAuth avatar_url), and falls back to a colored initial. Mirrors the webapp.
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
  const [failedSources, setFailedSources] = useState(0)

  const displayName = name || email?.split('@')[0] || null
  const initial = getInitial(displayName)
  const colorClass = getColorFromString(userId || displayName || 'default')
  const sizeClass = SIZE_CLASSES[size]

  const imageSources = useMemo(() => {
    const sources: string[] = []

    if (userId && avatarUpdatedAt) {
      const storageUrl = buildStorageUrl(userId, avatarUpdatedAt)
      if (storageUrl) sources.push(storageUrl)
    }

    if (src) sources.push(src)

    return sources
  }, [userId, avatarUpdatedAt, src])

  const currentSrc = imageSources[failedSources] || null

  const handleError = useCallback(() => {
    setFailedSources((prev) => prev + 1)
  }, [])

  const containerClass = twMerge(
    'rounded-full flex items-center justify-center font-medium shrink-0',
    sizeClass,
    className
  )

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

  return <div className={twMerge(containerClass, colorClass)}>{initial}</div>
}
