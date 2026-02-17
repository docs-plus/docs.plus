import { removeFileFromStorage, uploadFileToStorage } from '@api'
import * as toast from '@components/toast'
import Config from '@config'
import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useState } from 'react'

// --- Constants ---

const MAX_AVATAR_SIZE = 256_000 // 256 KB
const DB_PROPAGATION_DELAY = 1_000 // ms — wait for DB trigger to fire before auth update

// --- Avatar DB helper (pure — no React hooks) ---

const updateAvatarInDB = async (avatarUrl: string | null, userId: string): Promise<void> => {
  const avatar_updated_at = avatarUrl ? new Date().toISOString() : null

  const { error: dbError } = await supabaseClient
    .from('users')
    .update({ avatar_updated_at })
    .match({ id: userId })

  // Wait for DB trigger propagation before updating auth metadata
  await new Promise((resolve) => setTimeout(resolve, DB_PROPAGATION_DELAY))

  const { error: authError } = await supabaseClient.auth.updateUser({
    data: { avatar_updated_at, c_avatar_url: avatarUrl }
  })

  if (dbError || authError) {
    throw dbError || authError
  }
}

// --- Hook ---

export const useAvatarUpload = () => {
  const user = useAuthStore((state) => state.profile)
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(
    async (file: File) => {
      if (!user) return

      if (file.size > MAX_AVATAR_SIZE) {
        toast.Error('Avatar must be less than 256KB')
        return
      }

      if (!file.type.startsWith('image/')) {
        toast.Error('Avatar must be an image')
        return
      }

      setUploading(true)

      try {
        const filePath = `public/${user.id}.png`
        const bucketAddress = Config.app.profile.getAvatarURL(user.id, Date.now().toString())

        // Sequential: upload to storage first, then update DB on success
        await uploadFileToStorage(Config.app.profile.avatarBucketName, filePath, file)
        await updateAvatarInDB(bucketAddress, user.id)

        toast.Success('Avatar uploaded successfully!')
      } catch (error) {
        console.error('Avatar upload error:', error)
        toast.Error('Error uploading avatar, please try again.')
      } finally {
        setUploading(false)
      }
    },
    [user]
  )

  const handleRemove = useCallback(async () => {
    if (!user) return

    setUploading(true)

    try {
      // Sequential: update DB first (clear reference), then remove from storage
      await updateAvatarInDB(null, user.id)
      await removeFileFromStorage(Config.app.profile.avatarBucketName, `public/${user.id}.png`)

      toast.Success('Avatar removed successfully!')
    } catch (error) {
      console.error('Avatar remove error:', error)
      toast.Error('Error removing avatar, please try again.')
    } finally {
      setUploading(false)
    }
  }, [user])

  return { uploading, handleUpload, handleRemove }
}
