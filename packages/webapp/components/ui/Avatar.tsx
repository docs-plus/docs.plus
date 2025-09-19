/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { createAvatar } from '@dicebear/core'
import { lorelei, shapes, rings, initials } from '@dicebear/collection'
import { twx, cn } from '@utils/twx'
import { twMerge } from 'tailwind-merge'
import Config from '@config'
import { useStore } from '@stores'
import { UserProfileDialog } from '@components/ui/dialogs/UserProfileDialog'

type DivProps = React.ComponentProps<'div'> & {
  $online?: boolean
  $presence?: boolean
  $clickable?: boolean
  $typing?: boolean
}

const AContainer = twx.div<DivProps>((props) =>
  cn(
    `avatar border-gray-300`,
    props.$presence && (props.$online ? `online` : `offline`),
    props.$clickable ? 'cursor-pointer' : 'cursor-default',
    props.$typing && 'avatar-typing'
  )
)

export const Avatar = forwardRef(
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
      asChild,
      ...restProps
    }: any,
    ref: any
  ) => {
    const [imgSrc, setImgSrc] = useState(src)
    const openDialog = useStore((state) => state.openDialog)

    const generateDefaultAvatar = useCallback(() => {
      let collectionType
      switch (collection) {
        case 'shapes':
          collectionType = shapes
          break
        case 'rings':
          collectionType = rings
          break
        case 'initials':
          collectionType = initials
          break
        default:
          collectionType = lorelei
      }

      const svg: any = createAvatar(collectionType, {
        seed: restProps.id || alt, // Use alt as the seed for generating consistent avatars
        backgroundType: ['solid']
        // additional options can be added here
      })

      return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    }, [collection, restProps.id, alt])

    useEffect(() => {
      if (avatarUpdatedAt && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const bucketAddress = Config.app.profile.getAvatarURL(id, avatarUpdatedAt)
        setImgSrc(bucketAddress)
      } else if (src) {
        setImgSrc(src)
      } else {
        setImgSrc(generateDefaultAvatar())
      }
    }, [src, alt, avatarUpdatedAt, id, generateDefaultAvatar])

    const handleError = () => {
      setImgSrc(generateDefaultAvatar())
    }

    const handleClick = useCallback(() => {
      if (!id || !clickable) return

      openDialog(<UserProfileDialog userId={id} />, {
        size: 'lg'
      })
    }, [id, clickable, openDialog])

    const avatarStyle = twMerge(
      `w-auto h-full m-0 object-contain relative rounded-full bg-white`,
      clickable ? 'cursor-pointer' : 'cursor-default'
    )

    // Filter out DOM-invalid props that shouldn't reach styled components
    const { asChild: _asChild, ...validDOMProps } = restProps

    if (justImage)
      return <img alt={alt} src={imgSrc} onError={handleError} className={avatarStyle} />

    // Build container classes manually to avoid styled component prop issues
    const containerClasses = twMerge(
      'avatar border-gray-300',
      displayPresence && (online ? 'online' : 'offline'),
      clickable ? 'cursor-pointer' : 'cursor-default',
      status === 'TYPING' && 'avatar-typing'
    )

    return (
      <div className={containerClasses} {...validDOMProps} onClick={handleClick}>
        <img
          alt={alt}
          src={imgSrc}
          onError={handleError}
          className={twMerge(avatarStyle, 'h-full w-auto')}
          ref={ref}
        />
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
