import { updateUser } from '@api'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import { useCallback, useState } from 'react'

import { useUsernameValidation } from './useUsernameValidation'

interface SaveOptions {
  /** Custom success toast message */
  successToast?: string
  /** Skip username validation (e.g., when only links changed — avoids unnecessary API call) */
  skipUsernameValidation?: boolean
}

export const useProfileUpdate = () => {
  const [loading, setLoading] = useState(false)
  const { validateUsername } = useUsernameValidation()

  const handleSave = useCallback(
    async ({ successToast, skipUsernameValidation }: SaveOptions = {}) => {
      const currentProfile = useAuthStore.getState().profile
      if (!currentProfile) return
      setLoading(true)

      try {
        if (!skipUsernameValidation) {
          const { isValid, errorMessage } = await validateUsername(currentProfile.username)
          if (!isValid) {
            if (errorMessage) toast.Error(errorMessage)
            return
          }
        }

        // Narrowed payload: matches the public.users column UPDATE
        // whitelist enforced by scripts/13-RLS.sql. Sending columns
        // outside this set (id, email, created_at, …) errors with 42501.
        const payload = {
          username: currentProfile.username,
          full_name: currentProfile.full_name,
          avatar_url: currentProfile.avatar_url,
          avatar_updated_at: currentProfile.avatar_updated_at,
          profile_data: currentProfile.profile_data
        }

        const { data, error } = await updateUser(currentProfile.id, payload)

        if (error) {
          console.error(error)
          toast.Error('Error updating profile!')
        } else if (!data) {
          // Zero-row UPDATE — usually a stale auth session pointing at a
          // user that no longer exists in `public.users` (e.g. after a
          // local DB reset). Tell the user instead of swallowing.
          toast.Error('Profile not found. Please sign out and sign in again.')
        } else {
          toast.Success(successToast || 'Profile updated successfully!')
        }
      } catch (error) {
        console.error(error)
        toast.Error('Error updating profile!')
      } finally {
        setLoading(false)
      }
    },
    [validateUsername]
  )

  return { loading, handleSave }
}
