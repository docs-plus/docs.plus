// AvatarUploader.jsx
import React, { useRef, useState } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { Avatar, AVATAR_URL_CHANNEL_NAME } from '../../../../Avatar'
import { Camera, Spinner } from '../../../../icons/Icons'
import { toast } from 'react-hot-toast'
import PubSub from 'pubsub-js'

import { uploadAvatarToStorage, updateAvatarInDB } from './avatarUpload.service'

const AVATARS = 'avatars'
const PROFILES = 'profiles'
const PUBLIC = 'public'

const AvatarSection = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const fileInputRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = async (event) => {
    const avatarFile = event.target.files[0]
    setUploading(true)
    if (!avatarFile) return

    try {
      const filePath = `${PUBLIC}/${user.id}.png`
      await uploadAvatarToStorage(supabaseClient, AVATARS, filePath, avatarFile)
      const bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png`

      PubSub.publish(
        AVATAR_URL_CHANNEL_NAME,
        `${bucketAddress}?${Date.now().toString()}`
      )
      await updateAvatarInDB(supabaseClient, PROFILES, bucketAddress, user.id)

      toast.success('Avatar uploaded successfully!')
    } catch (error) {
      toast.error('Error uploading avatar, please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="avatar-uploader mt-4 w-32 h-32 relative rounded-xl border drop-shadow-sm overflow-hidden"
      onClick={handleClick}>
      <div
        className={` ${
          !uploading ? 'hover:opacity-50 opacity-0' : 'opacity-80 bg-white'
        } absolute w-full h-full transition-opacity cursor-pointer bg-black flex items-center justify-center`}>
        {!uploading ? <Camera size={24} fill="#fff" /> : <Spinner />}
      </div>
      <Avatar height={32} width={32} className="w-32 h-32" />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default AvatarSection
