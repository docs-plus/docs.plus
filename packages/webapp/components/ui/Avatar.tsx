/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback, forwardRef } from 'react'
import { createAvatar } from '@dicebear/core'
import { lorelei, shapes, rings, initials } from '@dicebear/collection'
import { twMerge } from 'tailwind-merge'
import Config from '@config'
import { useStore } from '@stores'
import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'

type AvatarCollectionKey = 'lorelei' | 'shapes' | 'rings' | 'initials'

type AvatarStatus = string | undefined

const avatarCollections = {
  lorelei,
  shapes,
  rings,
  initials
} as const

const isKnownCollection = (value: unknown): value is AvatarCollectionKey =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(avatarCollections, value)

export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  id?: string
  displayPresence?: boolean
  collection?: AvatarCollectionKey | string
  justImage?: boolean
  avatarUpdatedAt?: string | number | null
  online?: boolean
  src?: string | null
  alt?: string | null
  status?: AvatarStatus
  clickable?: boolean
  imageClassName?: string
  imageProps?: React.ComponentPropsWithoutRef<'img'>
}

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>((props, ref) => {
  const {
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
    ...restProps
  } = props

  const {
    className: imagePropsClassName,
    onClick: imagePropsOnClick,
    ...restImageProps
  } = imageProps ?? {}

  const openDialog = useStore((state) => state.openDialog)

  const resolvedCollection = useMemo(() => {
    if (isKnownCollection(collection)) {
      return avatarCollections[collection]
    }

    return avatarCollections.lorelei
  }, [collection])

  const defaultAvatar = useMemo(() => {
    const seed = id || alt || 'avatar'
    const svg = createAvatar(resolvedCollection, {
      seed,
      backgroundType: ['solid']
    }).toString()

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }, [alt, id, resolvedCollection])

  const [imgSrc, setImgSrc] = useState<string>(src || defaultAvatar)

  const altText = alt || 'User avatar'
  const isTyping = status === 'TYPING'

  useEffect(() => {
    if (avatarUpdatedAt && id && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const bucketAddress = Config.app.profile.getAvatarURL(id, avatarUpdatedAt.toString())
      setImgSrc(bucketAddress)
      return
    }

    if (src) return setImgSrc(src)

    setImgSrc(defaultAvatar)
  }, [avatarUpdatedAt, defaultAvatar, id, src])

  const handleImageError = useCallback(() => {
    setImgSrc(defaultAvatar)
  }, [defaultAvatar])

  const openProfileDialog = useCallback(() => {
    if (!clickable || !id) return
    openDialog(<UserProfileDialog userId={id} />, { size: 'lg' })
  }, [clickable, id, openDialog])

  const handleContainerClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      openProfileDialog()
      // externalOnClick?.(event)
    },
    [openProfileDialog]
  )

  const handleImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      // event.stopPropagation()
      openProfileDialog()
      imagePropsOnClick?.(event)
      // externalOnClick?.(event as unknown as React.MouseEvent<HTMLDivElement>)
    },
    [imagePropsOnClick, openProfileDialog]
  )

  const pointerClass = clickable ? 'cursor-pointer' : 'cursor-default'
  const typingClass = isTyping ? 'avatar-typing' : undefined
  const presenceClass = displayPresence ? (online ? 'online' : 'offline') : undefined

  const containerClassName = twMerge(
    'avatar border border-gray-300 bg-white rounded-full',
    presenceClass,
    pointerClass,
    typingClass,
    className
  )

  const baseImageClass = twMerge(
    'h-full w-full object-cover rounded-full bg-white',
    pointerClass,
    imageClassName,
    justImage ? className : undefined,
    imagePropsClassName
  )

  if (justImage) {
    return (
      <img
        {...(restProps as React.ComponentPropsWithoutRef<'img'>)}
        {...restImageProps}
        ref={ref}
        alt={altText}
        src={imgSrc}
        onError={handleImageError}
        onClick={handleImageClick}
        className={baseImageClass}
      />
    )
  }

  return (
    <div {...restProps} className={containerClassName} onClick={handleContainerClick}>
      <img
        {...restImageProps}
        ref={ref}
        alt={altText}
        src={imgSrc}
        onError={handleImageError}
        onClick={handleImageClick}
        className={baseImageClass}
      />
    </div>
  )
})

Avatar.displayName = 'Avatar'
