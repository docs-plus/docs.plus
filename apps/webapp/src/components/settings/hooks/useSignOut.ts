import { signOut } from '@api'
import * as toast from '@components/toast'
import { useState } from 'react'

import { consumeSettingsTakeoverEntry } from './useSettingsModal'

export const useSignOut = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    const { error } = await signOut()
    if (error) {
      toast.Error('Error signing out: ' + error.message)
    }
    // Consume the takeover's history entry first, or back after reload re-lands on it.
    await consumeSettingsTakeoverEntry()
    window.location.assign(window.location.pathname)
  }

  return {
    isLoading,
    handleSignOut
  }
}
