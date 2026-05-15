import { removeFileFromStorage, uploadFileToStorage } from '@api'
import * as toast from '@components/toast'
import Config from '@config'
import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useState } from 'react'

const MAX_AVATAR_SIZE = 256_000 // 256 KB

/**
 * Writes `avatar_url` + `avatar_updated_at` to `public.users` and mirrors
 * to auth metadata. Returns the persisted timestamp so callers patch
 * local state without a separate `new Date()` drifting from the row.
 */
const updateAvatarInDB = async (
  avatarUrl: string | null,
  userId: string
): Promise<string | null> => {
  const avatar_updated_at = avatarUrl ? new Date().toISOString() : null

  const { error: dbError } = await supabaseClient
    .from('users')
    .update({ avatar_url: avatarUrl, avatar_updated_at })
    .match({ id: userId })

  if (dbError) throw dbError

  // `c_` prefix avoids supabase auth's own `avatar_url` metadata key
  // (OAuth-provider-owned and overwritten on session refresh).
  const { error: authError } = await supabaseClient.auth.updateUser({
    data: { avatar_updated_at, c_avatar_url: avatarUrl }
  })

  if (authError) throw authError

  return avatar_updated_at
}

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
        // `{userId}/avatar.png` matches `getAvatarURL`'s shape so the
        // upload destination and the public read URL stay in lockstep,
        // and the prefix carries ownership for the path-based RLS check.
        const filePath = `${user.id}/avatar.png`
        const bucketAddress = Config.app.profile.getAvatarURL(user.id, Date.now().toString())

        const { error: uploadError } = await uploadFileToStorage(
          Config.app.profile.avatarBucketName,
          filePath,
          file
        )
        if (uploadError) throw uploadError

        const newAvatarUpdatedAt = await updateAvatarInDB(bucketAddress, user.id)

        // `auth.updateUser({ data })` (metadata-only) does not reliably
        // fire `USER_UPDATED` on the same client, so `onAuthStateChange`
        // never refetches via `getUserProfile`. Patch local profile
        // directly so the bucket URL + cache-buster are visible now.
        useAuthStore.getState().setProfile({
          ...user,
          avatar_url: bucketAddress,
          avatar_updated_at: newAvatarUpdatedAt
        })

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
      // DB-first: clear the reference before deleting the file. The
      // inverse would leave the row pointing at a deleted object → 404
      // on every Avatar render. An orphan file is the lesser evil.
      await updateAvatarInDB(null, user.id)
      await removeFileFromStorage(Config.app.profile.avatarBucketName, `${user.id}/avatar.png`)

      useAuthStore.getState().setProfile({ ...user, avatar_url: null, avatar_updated_at: null })

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
