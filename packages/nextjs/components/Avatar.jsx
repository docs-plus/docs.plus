import { useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import Image from 'next/image'

import PubSub from 'pubsub-js'

const AVATAR_URL_CHANNEL_NAME = 'updateAvatarURL'

const useAvatar = () => {
  const { id: userId, user_metadata } = useUser()
  const lastUpdate = Date.now().toString()

  const bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${userId}.png?${lastUpdate}`
  const [avatarUrl, setAvatarUrl] = useState(bucketAddress)

  return { avatarUrl, setAvatarUrl }
}

const Avatar = ({ defaultURI, height = 40, width = 40, ...props }) => {
  const { avatarUrl, setAvatarUrl } = useAvatar()
  const { id: userId, user_metadata } = useUser()

  PubSub.subscribe(AVATAR_URL_CHANNEL_NAME, (msg, newURL) => {
    setAvatarUrl(newURL)
  })

  return (
    <Image
      src={avatarUrl}
      width={width}
      onError={(e) => {
        if (user_metadata?.avatar_url) setAvatarUrl(user_metadata?.avatar_url)
        else {
          e.target.style.padding = '6px'
          e.target.classList.add('bg-gray-100')
          e.target.classList.add('dark:bg-gray-600')
          setAvatarUrl('/assets/avatar.svg')
        }
      }}
      height={height}
      alt="avatar"
      {...props}
    />
  )
}

export { Avatar, useAvatar, AVATAR_URL_CHANNEL_NAME }
