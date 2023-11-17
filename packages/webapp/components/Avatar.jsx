import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import PubSub from 'pubsub-js'
import { useAuthStore } from '@utils/supabase'

const AVATAR_URL_CHANNEL_NAME = 'updateAvatarURL'

const useAvatar = (srcAvatar) => {
  const user = useAuthStore.use.user()
  const { id: userId } = user

  const bucketAddress = useMemo(() => {
    const lastUpdate = Date.now().toString()

    return (
      user.user_metadata.avatar_url ||
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${userId}.png?${lastUpdate}`
    )
  }, [user.user_metadata.avatar_url, userId])

  const [avatarUrl, setAvatarUrl] = useState(srcAvatar || bucketAddress)

  return { avatarUrl, setAvatarUrl }
}

let Avatar = React.forwardRef(({ height, width, srcAvatar, ...props }, ref) => {
  const { avatarUrl, setAvatarUrl } = useAvatar(srcAvatar)
  const user = useAuthStore.use.user()

  const { user_metadata } = user

  useEffect(() => {
    if (srcAvatar) return
    PubSub.subscribe(AVATAR_URL_CHANNEL_NAME, (msg, newURL) => {
      setAvatarUrl(newURL)
    })
    return () => {
      PubSub.unsubscribe(AVATAR_URL_CHANNEL_NAME)
    }
  }, [])

  const onError = useCallback((e) => {
    if (user_metadata?.avatar_url && !srcAvatar) setAvatarUrl(user_metadata?.avatar_url)
    else {
      e.target.style.padding = '6px'
      e.target.classList.add('bg-gray-100')
      e.target.classList.add('dark:bg-gray-600')
      setAvatarUrl('/assets/avatar.svg')
    }
  }, [])

  return (
    <Image
      ref={ref}
      src={srcAvatar || avatarUrl}
      width={width}
      onError={onError}
      height={height}
      alt="avatar"
      {...props}
    />
  )
})

Avatar.displayName = 'AvatarComponent'

// TODO: improvment, check avatar props are Equal
Avatar = React.memo(Avatar)

export { Avatar, AVATAR_URL_CHANNEL_NAME }
