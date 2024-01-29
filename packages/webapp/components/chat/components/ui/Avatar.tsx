/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from 'react'
import { createAvatar } from '@dicebear/core'
import { lorelei, shapes, rings, initials } from '@dicebear/collection'
import { twx, cn } from '@utils/twx'

type DivProps = React.ComponentProps<'div'> & { $online?: boolean; $presence?: boolean }

const AContainer = twx.div<DivProps>((props) =>
  cn(`avatar`, props.$presence && (props.$online ? `online` : `offline`))
)
const AWrapper = twx.div`relative max-w-24 rounded-full bg-white`

export const Avatar = ({
  displayPresence = false,
  collection = 'lorelei',
  online,
  src,
  alt,
  size = 96,
  ...restProps
}: any) => {
  const [imgSrc, setImgSrc] = useState(src)

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
  }, [collection, restProps.id, alt]) // dependencies

  useEffect(() => {
    setImgSrc(src || generateDefaultAvatar())
  }, [src, alt])

  const handleError = () => {
    setImgSrc(generateDefaultAvatar())
  }

  const avatarStyle = `w-[${size}px] h-[${size}px] m-0 rounded-full object-contain`

  return (
    <AContainer $presence={displayPresence} $online={online} {...restProps}>
      <AWrapper className={avatarStyle}>
        <img alt={alt} src={imgSrc} onError={handleError} className={avatarStyle} />
      </AWrapper>
    </AContainer>
  )
}

Avatar.displayName = 'Avatar'
