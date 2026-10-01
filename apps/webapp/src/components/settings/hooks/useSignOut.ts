import { signOut } from '@api'
import * as toast from '@components/toast'
import { supabaseClient } from '@utils/supabase'
import { useState } from 'react'

import { flushPendingPreferenceWrites } from '../utils/pendingPreferenceWrites'
import { consumeSettingsTakeoverEntry } from './useSettingsModal'

export const useSignOut = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    await flushPendingPreferenceWrites()
    const { error } = await signOut()
    if (error) {
      // auth-js drops the local session even when the server call fails. Stay only if it did not,
      // or the reload below would hide the toast.
      const { data } = await supabaseClient.auth.getSession()
      if (data.session) {
        toast.Error('Couldn’t sign out. Try again.')
        setIsLoading(false)
        return
      }
    }
    // The returning-person row survives sign-out, or it would almost never appear.
    // "Not you?" on that row drops it.
    // Consume the takeover's history entry first, or back after reload re-lands on it.
    await consumeSettingsTakeoverEntry()
    window.location.assign(window.location.pathname)
  }

  return {
    isLoading,
    handleSignOut
  }
}
