import { Success } from './../../../../toast/Success'
import { useCallback, useState } from 'react'
import { updateUser } from '@api'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import { useUsernameValidation } from './useUsernameValidation'

export const useProfileUpdate = () => {
  const user = useAuthStore((state) => state.profile)
  const [loading, setLoading] = useState(false)
  const { validateUsername } = useUsernameValidation()

  const handleSave = useCallback(
    async ({ successToast }: { successToast?: string } = {}) => {
      if (!user) return
      setLoading(true)

      const { isValid, errorMessage } = await validateUsername(user?.username)
      if (!isValid) {
        if (errorMessage) {
          toast.Error(errorMessage)
        }
        setLoading(false)
        return
      }

      const getProfileData = useAuthStore.getState().profile || {}

      const { data, error } = await updateUser(user?.id, getProfileData)
      if (error) {
        console.error(error)
        toast.Error('Error updating profile!')
      } else {
        toast.Success(successToast || 'Profile updated successfully!')
      }

      setLoading(false)
    },
    [user, validateUsername]
  )

  return { loading, handleSave }
}
