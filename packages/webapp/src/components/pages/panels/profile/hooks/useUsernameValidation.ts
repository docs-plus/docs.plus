import { useAuthStore } from '@stores'
import { getSimilarUsername } from '@api'

const USERNAME_REGEX = /^[a-z][a-z0-9_-]{2,29}$/

interface ValidationResult {
  isValid: boolean
  errorMessage: string | null
}

export const useUsernameValidation = () => {
  const user = useAuthStore((state) => state.profile)

  const validateUsername = async (username?: string): Promise<ValidationResult> => {
    if (!username) {
      return { isValid: false, errorMessage: 'Username cannot be empty.' }
    }

    const normalizedUsername = username.toLowerCase()

    // If unchanged username
    if (normalizedUsername === user?.username) {
      return { isValid: true, errorMessage: null }
    }

    // Basic format checks
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      let errorMessage: string
      if (normalizedUsername.length < 3) {
        errorMessage = 'Username must be at least 3 characters long.'
      } else if (normalizedUsername.length > 30) {
        errorMessage = 'Username must be less than 30 characters.'
      } else if (!/^[a-z]/.test(normalizedUsername)) {
        errorMessage = 'Username must start with a letter.'
      } else {
        errorMessage =
          'Username can only contain lowercase letters, numbers, underscore, and hyphen.'
      }
      return { isValid: false, errorMessage }
    }

    // Check database for duplicates
    const { data, error } = await getSimilarUsername(normalizedUsername)
    if (error) {
      return { isValid: false, errorMessage: 'Error fetching user profile.' }
    }

    const isTaken = data.length > 0 && data[0].username !== user?.username
    if (isTaken) {
      return { isValid: false, errorMessage: 'Username already taken.' }
    }

    return { isValid: true, errorMessage: null }
  }

  return { validateUsername }
}
