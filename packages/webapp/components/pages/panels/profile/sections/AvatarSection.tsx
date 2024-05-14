import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Avatar, AVATAR_URL_CHANNEL_NAME } from '@components/ui/Avatar'
import { Camera, Spinner, CircleUser } from '@icons'
import { toast } from 'react-hot-toast'
import PubSub from 'pubsub-js'
import { supabaseClient } from '@utils/supabase'
import { useAuthStore } from '@stores'

import {
  uploadAvatarToStorage,
  updateAvatarInDB,
  removeAvatarFromStorage
} from './avatarUpload.service'

const AVATARS = 'avatars'
const PROFILES = 'profiles'
const PUBLIC = 'public'

const AvatarSection = () => {
  const user = useAuthStore((state) => state.profile)
  const displayName = useAuthStore((state) => state.displayName)
  const fileInputRef = useRef() as any
  const [uploading, setUploading] = useState(false)
  const [isProfileAvatar, setIsProfileAvatar] = useState(false)

  useEffect(() => {
    const profileAvatart = user?.avatar_url
    setIsProfileAvatar(profileAvatart ? true : false)
  }, [user])

  const handleClick = useCallback((e: any) => {
    if (e.target.parentElement.classList.contains('changeAvatarToDefault')) return
    if (['input', 'div', 'svg'].includes(e.target.localName)) {
      fileInputRef?.current?.click()
    }
  }, [])

  const handleFileChange = useCallback(
    async (event: any) => {
      const avatarFile = event.target.files[0]

      if (event.target?.files[0]?.size > 256000) {
        toast.error('Avatar must be at least 256kb')
        return
      }

      if (!event.target?.files[0]?.type.includes('image')) {
        toast.error('Avatar must be an image')
        return
      }

      setUploading(true)

      if (!avatarFile) return

      try {
        const filePath = `${PUBLIC}/${user?.id}.png`
        await uploadAvatarToStorage(supabaseClient, AVATARS, filePath, avatarFile)
        const bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user?.id}.png`

        //@ts-ignore
        PubSub.publish(AVATAR_URL_CHANNEL_NAME, `${bucketAddress}?${Date.now().toString()}`)

        await updateAvatarInDB(supabaseClient, PROFILES, bucketAddress, user?.id)
        setIsProfileAvatar(true)

        toast.success('Avatar uploaded successfully!')
      } catch (error) {
        console.error(error)
        toast.error('Error uploading avatar, please try again.')
      } finally {
        setUploading(false)
      }
    },
    [supabaseClient, user]
  )

  const changeAvatarToDefault = useCallback(async () => {
    const googleAvatar = user?.avatar_url
    // if (isAvatarDefault) return
    try {
      await updateAvatarInDB(supabaseClient, PROFILES, null, user?.id)

      //@ts-ignore
      PubSub.publish(AVATAR_URL_CHANNEL_NAME, googleAvatar)

      await removeAvatarFromStorage(supabaseClient, AVATARS, `${PUBLIC}/${user?.id}.png`)
      setIsProfileAvatar(false)

      toast.success('Avatar changed successfully!')
    } catch (error) {
      toast.error('Error changing avatar, please try again.')
    }
  }, [supabaseClient, user])

  return (
    <div
      className="avatar-uploader relative mt-4 size-32 rounded-xl border drop-shadow-sm "
      onClick={handleClick}>
      <div
        className={` ${
          !uploading ? 'opacity-0 hover:opacity-50' : 'bg-white opacity-80'
        } absolute flex size-full cursor-pointer items-center justify-center rounded-xl bg-black transition-opacity`}>
        {!uploading ? <Camera size={24} fill="#fff" /> : <Spinner />}
      </div>
      <Avatar
        id={user?.id}
        src={user?.avatar_url}
        alt={displayName}
        justImage={true}
        className="size-32"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {isProfileAvatar && (
        <button
          className="changeAvatarToDefault absolute -bottom-1 -right-1 flex size-5  items-center justify-around rounded-full bg-white drop-shadow-lg"
          onClick={changeAvatarToDefault}
          title="Change to default avatar">
          <CircleUser size={18} className=" z-10 size-5 rounded-full bg-white drop-shadow-lg" />
        </button>
      )}
    </div>
  )
}

export default AvatarSection
