import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'
import { userProfileDialogOpenConfig } from '@components/ui/dialogs/userProfileDialogOpenConfig'
import { Tooltip } from '@components/ui/Tooltip'
import Config from '@config'
import { initials, lorelei, rings, shapes } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { Placement } from '@floating-ui/react'
import { useStore } from '@stores'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type AvatarCollectionKey = 'lorelei' | 'shapes' | 'rings' | 'initials'

const AVATAR_COLLECTIONS = {
  lorelei,
  shapes,
  rings,
  initials
} as const

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14',
  '2xl': 'size-16'
}

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
  size?: AvatarSize
  imageClassName?: string
  imageProps?: React.ComponentPropsWithoutRef<'img'>
  tooltip?: string
  tooltipPosition?: Placement
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
    // 0 = bucket (custom upload), 1 = remote src (usually OAuth), 2 = DiceBear
    const [loadStage, setLoadStage] = useState(0)

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

    const bucketSrc = useMemo(() => {
      if (!id || !avatarUpdatedAt || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
      return Config.app.profile.getAvatarURL(id, String(avatarUpdatedAt))
    }, [id, avatarUpdatedAt])

    const remoteSrc = src?.trim() || null

    useEffect(() => {
      setLoadStage(0)
    }, [bucketSrc, remoteSrc, id])

    const imgSrc = useMemo(() => {
      if (loadStage >= 2) return fallbackAvatar
      if (loadStage === 1) return remoteSrc || fallbackAvatar
      return bucketSrc || remoteSrc || fallbackAvatar
    }, [loadStage, bucketSrc, remoteSrc, fallbackAvatar])

    const handleError = useCallback(() => {
      setLoadStage((stage) => {
        if (stage !== 0) return 2
        if (bucketSrc && remoteSrc && remoteSrc !== bucketSrc) return 1
        return 2
      })
    }, [bucketSrc, remoteSrc])

    const handleClick = useCallback(() => {
      if (!clickable || !id) return
      openDialog(<UserProfileDialog userId={id} />, userProfileDialogOpenConfig)
    }, [clickable, id, openDialog])

    const isTyping = status === 'TYPING'
    const sizeClass = SIZE_CLASSES[size]
    const cursorClass = clickable && id ? 'cursor-pointer' : 'cursor-default'

    const containerClass = twMerge(
      'avatar',
      sizeClass,
      'rounded-full',
      'bg-base-200',
      '!ring-1 ring-base-300',
      '!overflow-visible',
      displayPresence && (online ? 'avatar-online' : 'avatar-offline'),
      isTyping && 'avatar-typing',
      cursorClass,
      className
    )

    const imgClass = twMerge(
      'size-full',
      'rounded-full',
      'object-cover',
      'bg-base-200',
      'shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-base-content)_6%,transparent)]',
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

    const container = (
      <div {...restProps} className={containerClass} onClick={handleClick}>
        {imgElement}
      </div>
    )

    if (tooltip) {
      return (
        <Tooltip title={tooltip} placement={tooltipPosition}>
          {container}
        </Tooltip>
      )
    }

    return container
  }
)

Avatar.displayName = 'Avatar'
