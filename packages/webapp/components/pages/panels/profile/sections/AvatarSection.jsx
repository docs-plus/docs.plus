import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Avatar, AVATAR_URL_CHANNEL_NAME } from '../../../../Avatar'
import { Camera, Spinner, CircleUser } from '@icons'
import { toast } from 'react-hot-toast'
import PubSub from 'pubsub-js'
import { useAuthStore, supabaseClient } from '@utils/supabase'

import {
  uploadAvatarToStorage,
  updateAvatarInDB,
  removeAvatarFromStorage
} from './avatarUpload.service'

const AVATARS = 'avatars'
const PROFILES = 'profiles'
const PUBLIC = 'public'

const AvatarSection = ({ profileData }) => {
  const { user } = useAuthStore()
  const fileInputRef = useRef()
  const [uploading, setUploading] = useState(false)
  const [isProfileAvatar, setIsProfileAvatar] = useState(false)

  useEffect(() => {
    const profileAvatart = profileData?.avatar_url
    setIsProfileAvatar(profileAvatart ? true : false)
  }, [profileData])

  const handleClick = useCallback((e) => {
    if (e.target.parentElement.classList.contains('changeAvatarToDefault')) return
    if (['input', 'div', 'svg'].includes(e.target.localName)) {
      fileInputRef.current.click()
    }
  }, [])

  const handleFileChange = useCallback(
    async (event) => {
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
        const filePath = `${PUBLIC}/${user.id}.png`
        await uploadAvatarToStorage(supabaseClient, AVATARS, filePath, avatarFile)
        const bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png`

        PubSub.publish(AVATAR_URL_CHANNEL_NAME, `${bucketAddress}?${Date.now().toString()}`)
        await updateAvatarInDB(supabaseClient, PROFILES, bucketAddress, user.id)
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
    const googleAvatar = user?.user_metadata?.picture
    // if (isAvatarDefault) return
    try {
      await updateAvatarInDB(supabaseClient, PROFILES, null, user.id)
      PubSub.publish(AVATAR_URL_CHANNEL_NAME, googleAvatar)

      await removeAvatarFromStorage(supabaseClient, AVATARS, `${PUBLIC}/${user.id}.png`)
      setIsProfileAvatar(false)

      toast.success('Avatar changed successfully!')
    } catch (error) {
      toast.error('Error changing avatar, please try again.')
    }
  }, [supabaseClient, user])

  return (
    <div
      className="avatar-uploader mt-4 w-32 h-32 relative rounded-xl border drop-shadow-sm "
      onClick={handleClick}>
      <div
        className={` ${
          !uploading ? 'hover:opacity-50 opacity-0' : 'opacity-80 bg-white'
        } absolute w-full h-full transition-opacity cursor-pointer rounded-xl bg-black flex items-center justify-center`}>
        {!uploading ? <Camera size={24} fill="#fff" /> : <Spinner />}
      </div>
      <Avatar height={32} width={32} className="w-32 h-32 rounded-xl" />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {isProfileAvatar && (
        <button
          className="changeAvatarToDefault -right-1 absolute flex items-center justify-around  -bottom-1 w-5 h-5 bg-white rounded-full drop-shadow-lg"
          onClick={changeAvatarToDefault}
          title="Change to default avatar">
          <CircleUser size={18} className=" w-5 h-5 bg-white rounded-full drop-shadow-lg z-10" />
        </button>
      )}
    </div>
  )
}

export default AvatarSection
