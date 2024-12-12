import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Avatar } from '@components/ui/Avatar'
import { Camera, Spinner, CircleUser } from '@icons'
import { supabaseClient } from '@utils/supabase'
import { useAuthStore } from '@stores'
import Config from '@config'
import * as toast from '@components/toast'
import { removeFileFromStorage, uploadFileToStorage } from '@api'

// update avatart must be done step by step, in order to avoid race condition
const updateAvatarInDB = async (avatarUrl: string | null, userId: string) => {
  try {
    const avatar_updated_at = avatarUrl ? new Date().toISOString() : null

    const { data: dbData, error: dbError } = await supabaseClient
      .from('users')
      .update({ avatar_updated_at })
      .match({ id: userId })

    // await for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const { data: authData, error: authError } = await supabaseClient.auth.updateUser({
      data: { avatar_updated_at, c_avatar_url: avatarUrl }
    })

    if (dbError || authError) {
      throw dbError || authError
    }

    return true
  } catch (error) {
    console.error(error)
    throw error
  }
}

const AvatarSection = () => {
  const user = useAuthStore((state) => state.profile)
  const displayName = useAuthStore((state) => state.displayName)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
        toast.Error('Avatar must be at least 256kb')
        return
      }

      if (!event.target?.files[0]?.type.includes('image')) {
        toast.Error('Avatar must be an image')
        return
      }

      setUploading(true)

      if (!avatarFile) return
      if (!user) return

      try {
        const filePath = `public/${user?.id}.png`
        const bucketAddress = Config.app.profile.getAvatarURL(user?.id, Date.now().toString())

        const [uploadResult, dbResult] = await Promise.allSettled([
          uploadFileToStorage(Config.app.profile.avatarBucketName, filePath, avatarFile),
          updateAvatarInDB(bucketAddress, user?.id)
        ])

        if (uploadResult.status === 'rejected' || dbResult.status === 'rejected') {
          toast.Error('Error uploading avatar, please try again.')
        }

        setIsProfileAvatar(true)
        toast.Success('Avatar uploaded successfully!')
      } catch (error) {
        console.error(error)
        toast.Error('Error uploading avatar, please try again.')
      } finally {
        setUploading(false)
      }
    },
    [supabaseClient, user]
  )

  const changeAvatarToDefault = useCallback(async () => {
    if (!user) return
    try {
      const [dbResult, storageResult] = await Promise.allSettled([
        updateAvatarInDB(null, user?.id),
        removeFileFromStorage(Config.app.profile.avatarBucketName, `public/${user?.id}.png`)
      ])

      if (dbResult.status === 'rejected' || storageResult.status === 'rejected') {
        toast.Error('Error changing avatar, please try again.')
      }

      setIsProfileAvatar(false)

      toast.Success('Avatar changed successfully!')
    } catch (error) {
      console.error(error)
      toast.Error('Error changing avatar, please try again.')
    }
  }, [supabaseClient, user])

  return (
    <div
      className="avatar-uploader relative mt-4 flex size-28 items-center justify-center rounded-xl border drop-shadow-sm"
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
        avatarUpdatedAt={user?.avatar_updated_at}
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
          className="changeAvatarToDefault absolute -bottom-1 -right-1 flex size-5 items-center justify-around rounded-full bg-white drop-shadow-lg"
          onClick={changeAvatarToDefault}
          title="Change to default avatar">
          <CircleUser size={18} className="z-10 size-5 rounded-full bg-white drop-shadow-lg" />
        </button>
      )}
    </div>
  )
}

export default AvatarSection
