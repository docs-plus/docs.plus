import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'
import { userProfileDialogOpenConfig } from '@components/ui/dialogs/userProfileDialogOpenConfig'
import { Tooltip } from '@components/ui/Tooltip'
import Config from '@config'
import { initials, lorelei, rings, shapes } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { Placement } from '@floating-ui/react'
import { useStore } from '@stores'
import { type FaceSource, resolveFace } from '@utils/avatarFace'
import {
  type AvatarEdge,
  avatarEdgeClass,
  type AvatarSize,
  SIZE_CLASSES
} from '@utils/avatarStackGeometry'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export type { AvatarEdge, AvatarSize }
export { SIZE_CLASSES }

type AvatarCollectionKey = 'lorelei' | 'shapes' | 'rings' | 'initials'

const AVATAR_COLLECTIONS = {
  lorelei,
  shapes,
  rings,
  initials
} as const

export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Boundary shapes (camel/snake/`user_id`) — resolved once; explicit id/src/alt win. */
  face?: FaceSource | null
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
  /** Default `ring`. Stacks pass `paper`/`well`; gallery uses `none`. */
  edge?: AvatarEdge
  imageClassName?: string
  imageProps?: React.ComponentPropsWithoutRef<'img'>
  tooltip?: string
  tooltipPosition?: Placement
}

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  (
    {
      face,
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
      edge = 'ring',
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

    const resolved = resolveFace(face)
    const resolvedId = id ?? resolved.id
    const resolvedSrc = src !== undefined ? src : resolved.src
    const resolvedAvatarUpdatedAt =
      avatarUpdatedAt !== undefined ? avatarUpdatedAt : resolved.avatarUpdatedAt
    const resolvedAlt = alt ?? resolved.alt

    const fallbackAvatar = useMemo(() => {
      const resolvedCollection =
        collection in AVATAR_COLLECTIONS
          ? AVATAR_COLLECTIONS[collection as AvatarCollectionKey]
          : AVATAR_COLLECTIONS.lorelei

      const svg = createAvatar(resolvedCollection, {
        seed: resolvedId || resolvedAlt || 'avatar',
        backgroundType: ['solid']
      }).toString()

      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    }, [resolvedId, resolvedAlt, collection])

    const bucketSrc = useMemo(() => {
      if (!resolvedId || !resolvedAvatarUpdatedAt || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return null
      }
      return Config.app.profile.getAvatarURL(resolvedId, String(resolvedAvatarUpdatedAt))
    }, [resolvedId, resolvedAvatarUpdatedAt])

    const remoteSrc = resolvedSrc?.trim() || null

    useEffect(() => {
      setLoadStage(0)
    }, [bucketSrc, remoteSrc, resolvedId])

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
      if (!clickable || !resolvedId) return
      openDialog(<UserProfileDialog userId={resolvedId} />, userProfileDialogOpenConfig)
    }, [clickable, resolvedId, openDialog])

    const isTyping = status === 'TYPING'
    const sizeClass = SIZE_CLASSES[size]
    const cursorClass = clickable && resolvedId ? 'cursor-pointer' : 'cursor-default'
    const edgeClass = avatarEdgeClass(edge)
    const showInsetKeyline = edge === 'ring'

    const containerClass = twMerge(
      'avatar',
      sizeClass,
      'rounded-full',
      'bg-base-200',
      edgeClass,
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
      showInsetKeyline &&
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
        alt={resolvedAlt || 'User avatar'}
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
