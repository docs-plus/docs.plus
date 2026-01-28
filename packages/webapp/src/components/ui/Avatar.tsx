import { useState, useMemo, useCallback, forwardRef } from 'react'
import { createAvatar } from '@dicebear/core'
import { lorelei, shapes, rings, initials } from '@dicebear/collection'
import { twMerge } from 'tailwind-merge'
import Config from '@config'
import { useStore } from '@stores'
import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'

type AvatarCollectionKey = 'lorelei' | 'shapes' | 'rings' | 'initials'

const AVATAR_COLLECTIONS = {
  lorelei,
  shapes,
  rings,
  initials
} as const

/**
 * Avatar size presets following Tailwind spacing scale
 * Maps size names to Tailwind size classes
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'size-6', // 24px
  sm: 'size-8', // 32px
  md: 'size-10', // 40px
  lg: 'size-12', // 48px
  xl: 'size-14', // 56px
  '2xl': 'size-16' // 64px
}

export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** User ID for fetching avatar from storage */
  id?: string
  /** Show online/offline presence indicator */
  displayPresence?: boolean
  /** DiceBear collection for fallback avatar */
  collection?: AvatarCollectionKey | string
  /** Render only the image element without wrapper */
  justImage?: boolean
  /** Timestamp for cache-busting avatar URL */
  avatarUpdatedAt?: string | number | null
  /** Online status for presence indicator */
  online?: boolean
  /** Image source URL */
  src?: string | null
  /** Alt text for image */
  alt?: string | null
  /** User status (e.g., 'TYPING') */
  status?: string
  /** Enable click to open profile dialog */
  clickable?: boolean
  /** Preset size following design system */
  size?: AvatarSize
  /** Additional classes for the image element */
  imageClassName?: string
  /** Additional props for the image element */
  imageProps?: React.ComponentPropsWithoutRef<'img'>
  /** Tooltip text (daisyUI) */
  tooltip?: string
  /** Tooltip position (daisyUI) */
  tooltipPosition?: 'tooltip-top' | 'tooltip-bottom' | 'tooltip-left' | 'tooltip-right'
}

/**
 * Avatar component following docs.plus design system
 *
 * Uses daisyUI avatar classes with custom styling for:
 * - Consistent sizing via size presets
 * - Soft border and shadow for depth
 * - Online/offline presence indicators
 * - Fallback to generated avatars
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Avatar id={userId} size="md" />
 *
 * // With presence indicator
 * <Avatar id={userId} displayPresence online size="lg" />
 *
 * // Non-clickable
 * <Avatar id={userId} clickable={false} size="sm" />
 * ```
 */
export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  (
    {
      id,
      displayPresence = false,
      collection = 'lorelei',
      justImage = false,
      avatarUpdatedAt,
      online,
      src,
      alt,
      status,
      clickable = true,
      size = 'md',
      className,
      imageClassName,
      imageProps,
      tooltip,
      tooltipPosition,
      ...restProps
    },
    ref
  ) => {
    const openDialog = useStore((state) => state.openDialog)
    const [hasError, setHasError] = useState(false)

    // Generate fallback avatar using DiceBear
    const fallbackAvatar = useMemo(() => {
      const resolvedCollection =
        collection in AVATAR_COLLECTIONS
          ? AVATAR_COLLECTIONS[collection as AvatarCollectionKey]
          : AVATAR_COLLECTIONS.lorelei

      const svg = createAvatar(resolvedCollection, {
        seed: id || alt || 'avatar',
        backgroundType: ['solid']
      }).toString()

      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    }, [id, alt, collection])

    // Derive image source with priority: bucket URL > src prop > fallback
    const imgSrc = useMemo(() => {
      if (hasError) return fallbackAvatar

      if (avatarUpdatedAt && id && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return Config.app.profile.getAvatarURL(id, avatarUpdatedAt.toString())
      }

      return src || fallbackAvatar
    }, [hasError, avatarUpdatedAt, id, src, fallbackAvatar])

    const handleError = useCallback(() => setHasError(true), [])

    const handleClick = useCallback(() => {
      if (!clickable || !id) return
      openDialog(<UserProfileDialog userId={id} />, { size: 'lg' })
    }, [clickable, id, openDialog])

    // Derive classes
    const isTyping = status === 'TYPING'
    const sizeClass = SIZE_CLASSES[size]
    const cursorClass = clickable && id ? 'cursor-pointer' : 'cursor-default'

    // Container uses daisyUI avatar class with custom styling
    // Uses subtle gray ring instead of white border for visibility on any background
    const containerClass = twMerge(
      'avatar',
      sizeClass,
      'rounded-full',
      'bg-slate-100',
      '!ring-1 ring-base-300',
      '!overflow-visible',
      displayPresence && (online ? 'avatar-online' : 'avatar-offline'),
      isTyping && 'avatar-typing',
      tooltip && 'tooltip',
      tooltip && tooltipPosition,
      cursorClass,
      className
    )

    // Image styling with inset shadow for inner definition on light images
    const imgClass = twMerge(
      'size-full',
      'rounded-full',
      'object-cover',
      'bg-slate-100',
      'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
      cursorClass,
      imageClassName,
      justImage && className,
      imageProps?.className
    )

    const imgElement = (
      <img
        {...imageProps}
        ref={ref}
        alt={alt || 'User avatar'}
        src={imgSrc}
        onError={handleError}
        onClick={handleClick}
        className={imgClass}
      />
    )

    if (justImage) {
      return imgElement
    }

    return (
      <div {...restProps} className={containerClass} onClick={handleClick} data-tip={tooltip}>
        {imgElement}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
