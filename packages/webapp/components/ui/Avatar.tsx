/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { createAvatar } from '@dicebear/core'
import { lorelei, shapes, rings, initials } from '@dicebear/collection'
import { twx, cn } from '@utils/twx'
import Config from '@config'
import { useUserModal } from '@context/UserModalContext'

type DivProps = React.ComponentProps<'div'> & {
  $online?: boolean
  $presence?: boolean
  $clickable?: boolean
}

const AContainer = twx.div<DivProps>((props) =>
  cn(
    `avatar`,
    props.$presence && (props.$online ? `online` : `offline`),
    props.$clickable ? 'cursor-pointer' : 'cursor-default'
  )
)
const AWrapper = twx.div`relative max-w-24 rounded-full bg-white`

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
      size = 96,
      clickable = true,
      ...restProps
    }: any,
    ref: any
  ) => {
    const [imgSrc, setImgSrc] = useState(src)
    const { openUserModal } = useUserModal()

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
        console.log('bucketAddress', { bucketAddress })
        setImgSrc(bucketAddress)
      } else if (src) {
        setImgSrc(src)
      } else {
        setImgSrc(generateDefaultAvatar())
      }
    }, [src, alt, avatarUpdatedAt, id])

    const handleError = () => {
      setImgSrc(generateDefaultAvatar())
    }

    const handleClick = () => {
      if (id && clickable) {
        openUserModal(id)
      }
    }

    const avatarStyle = `w-[${size}px] h-[${size}px] m-0 rounded-full object-contain`

    if (justImage)
      return <img alt={alt} src={imgSrc} onError={handleError} className={avatarStyle} />

    return (
      <AContainer
        $presence={displayPresence}
        $online={online}
        $clickable={clickable}
        {...restProps}
        onClick={handleClick}>
        <AWrapper className={avatarStyle}>
          <img alt={alt} src={imgSrc} onError={handleError} className={avatarStyle} ref={ref} />
        </AWrapper>
      </AContainer>
    )
  }
)

Avatar.displayName = 'Avatar'
