import { type ProfileChange, updateProfile } from '@api'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import type { Profile, ProfileData } from '@types'
import { useCallback, useState } from 'react'

import { useUsernameValidation } from './useUsernameValidation'

type SavedFields = Pick<Profile, 'username' | 'full_name' | 'profile_data'>

/**
 * Shows the change at once, then saves only what it names. The server merges top-level
 * `profile_data` keys, so saving the bio never replaces links another device wrote.
 * A refused or failed save puts back only the fields it touched.
 */
export const useProfileUpdate = () => {
  const [loading, setLoading] = useState(false)
  const { validateUsername } = useUsernameValidation()

  const handleSave = useCallback(
    async (change: ProfileChange, successToast?: string) => {
      const { profile: previous, setProfile } = useAuthStore.getState()
      if (!previous) return false
      const apply = (source: SavedFields) => {
        const current = useAuthStore.getState().profile
        if (!current) return
        setProfile({
          ...current,
          ...('username' in change && { username: source.username }),
          ...('full_name' in change && { full_name: source.full_name }),
          profile_data: {
            ...current.profile_data,
            ...pickKeys(source.profile_data, change.profile_data)
          }
        })
      }

      apply({
        username: change.username ?? previous.username,
        full_name: change.full_name ?? previous.full_name,
        profile_data: { ...previous.profile_data, ...change.profile_data }
      })
      setLoading(true)
      try {
        if (change.username !== undefined) {
          const { isValid, errorMessage } = await validateUsername(change.username)
          if (!isValid) {
            apply(previous)
            if (errorMessage) toast.Error(errorMessage)
            return false
          }
        }

        const { data, error } = await updateProfile(change)
        if (error || !data) {
          apply(previous)
          if (error) console.error(error)
          // No row: a stale session for a user that no longer exists (e.g. after a local reset).
          toast.Error(
            error ? 'Couldn’t save your profile.' : 'Profile not found. Sign out and sign in again.'
          )
          return false
        }
        apply(data as SavedFields)
        if (successToast) toast.Success(successToast)
        return true
      } catch (error) {
        console.error(error)
        apply(previous)
        toast.Error('Couldn’t save your profile.')
        return false
      } finally {
        setLoading(false)
      }
    },
    [validateUsername]
  )

  return { loading, handleSave }
}

const pickKeys = (from: ProfileData | undefined, keysOf: Partial<ProfileData> | undefined) =>
  Object.fromEntries(
    Object.keys(keysOf ?? {}).map((key) => [key, from?.[key as keyof ProfileData]])
  ) as Partial<ProfileData>
