import { getSimilarUsername } from '@api'
import { useAuthStore } from '@stores'
import { useCallback } from 'react'

const USERNAME_REGEX = /^[a-z][a-z0-9_-]{2,29}$/

interface ValidationResult {
  isValid: boolean
  errorMessage: string | null
}

export const useUsernameValidation = () => {
  const currentUsername = useAuthStore((state) => state.profile?.username)

  const validateUsername = useCallback(
    async (username?: string): Promise<ValidationResult> => {
      if (!username) return { isValid: false, errorMessage: 'Username cannot be empty.' }

      const normalized = username.toLowerCase()
      if (normalized === currentUsername) return { isValid: true, errorMessage: null }

      if (!USERNAME_REGEX.test(normalized)) {
        const errorMessage =
          normalized.length < 3
            ? 'Username must be at least 3 characters long.'
            : normalized.length > 30
              ? 'Username must be less than 30 characters.'
              : !/^[a-z]/.test(normalized)
                ? 'Username must start with a letter.'
                : 'Username can only contain lowercase letters, numbers, underscore, and hyphen.'
        return { isValid: false, errorMessage }
      }

      const { data, error } = await getSimilarUsername(normalized)
      if (error) return { isValid: false, errorMessage: 'Error fetching user profile.' }
      const rows = data ?? []
      const isTaken = rows.length > 0 && rows[0].username !== currentUsername
      return isTaken
        ? { isValid: false, errorMessage: 'Username already taken.' }
        : { isValid: true, errorMessage: null }
    },
    [currentUsername]
  )

  return { validateUsername }
}
