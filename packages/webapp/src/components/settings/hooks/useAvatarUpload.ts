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

/**
 * Writes `avatar_updated_at` to `public.users` and mirrors to auth
 * metadata. Returns the timestamp it wrote so the caller can patch
 * local state with the exact value persisted (no drift from a separate
 * `new Date()` call).
 */
const updateAvatarInDB = async (
  avatarUrl: string | null,
  userId: string
): Promise<string | null> => {
  const avatar_updated_at = avatarUrl ? new Date().toISOString() : null

  const { error: dbError } = await supabaseClient
    .from('users')
    .update({ avatar_updated_at })
    .match({ id: userId })

  if (dbError) throw dbError

  // Wait for DB trigger propagation before updating auth metadata
  await new Promise((resolve) => setTimeout(resolve, DB_PROPAGATION_DELAY))

  const { error: authError } = await supabaseClient.auth.updateUser({
    data: { avatar_updated_at, c_avatar_url: avatarUrl }
  })

  if (authError) throw authError

  return avatar_updated_at
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
        // Path: `{userId}/avatar.png` — the {userId} folder prefix encodes
        // ownership for the path-based RLS check on the bucket. Matches
        // `getAvatarURL`'s URL shape so the upload destination and the
        // public read URL stay in lockstep.
        const filePath = `${user.id}/avatar.png`
        const bucketAddress = Config.app.profile.getAvatarURL(user.id, Date.now().toString())

        // Surface storage errors instead of swallowing them — RLS / quota
        // failures used to proceed silently to the DB write, leaving a
        // fresh `avatar_updated_at` pointing at the OLD bucket file.
        const { error: uploadError } = await uploadFileToStorage(
          Config.app.profile.avatarBucketName,
          filePath,
          file
        )
        if (uploadError) throw uploadError

        const newAvatarUpdatedAt = await updateAvatarInDB(bucketAddress, user.id)

        // Patch local profile directly. `auth.updateUser({ data: ... })`
        // (metadata-only) does NOT reliably fire `USER_UPDATED` on the
        // same client in current Supabase, so the `onAuthStateChange`
        // handler's `getUserProfile` refetch never runs — without this
        // call the Avatar component keeps the old `avatar_updated_at`
        // cache-buster and the browser serves the cached old image.
        useAuthStore.getState().setProfile({ ...user, avatar_updated_at: newAvatarUpdatedAt })

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
      await removeFileFromStorage(Config.app.profile.avatarBucketName, `${user.id}/avatar.png`)

      // Mirror the local state patch from `handleUpload` — same reason:
      // `USER_UPDATED` won't reliably fire here either.
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
