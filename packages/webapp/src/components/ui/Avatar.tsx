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

export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  id?: string
  displayPresence?: boolean
  collection?: AvatarCollectionKey | string
  justImage?: boolean
  avatarUpdatedAt?: string | number | null
  online?: boolean
  src?: string | null
  alt?: string | null
  status?: string
  clickable?: boolean
  imageClassName?: string
  imageProps?: React.ComponentPropsWithoutRef<'img'>
  // Tooltip (daisyUI)
  tooltip?: string
  tooltipPosition?: 'tooltip-top' | 'tooltip-bottom' | 'tooltip-left' | 'tooltip-right'
}

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

    // Generate fallback avatar
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

    // Derive image source
    const imgSrc = useMemo(() => {
      if (hasError) return fallbackAvatar

      // Priority: bucket URL > src prop > fallback
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

    // Classes
    const isTyping = status === 'TYPING'
    const cursorClass = clickable ? 'cursor-pointer' : 'cursor-default'

    const containerClass = twMerge(
      'avatar border border-gray-300 bg-white rounded-full !overflow-visible',
      displayPresence && (online ? 'online' : 'offline'),
      isTyping && 'avatar-typing',
      tooltip && 'tooltip',
      tooltip && tooltipPosition,
      cursorClass,
      className
    )

    const imgClass = twMerge(
      'h-full w-full object-cover rounded-full bg-white',
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
