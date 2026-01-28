import { useState } from 'react'
import { signOut } from '@api'
import * as toast from '@components/toast'

export const useSignOut = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    const { error } = await signOut()
    if (error) {
      toast.Error('Error signing out: ' + error.message)
    }
    window.location.assign(window.location.pathname)
  }

  return {
    isLoading,
    handleSignOut
  }
}
