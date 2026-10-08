import { signOut } from '@api'
import * as toast from '@components/toast'
import { isPushSupported, unregisterPushSubscription } from '@utils/push-notifications'
import { supabaseClient } from '@utils/supabase'
import { useState } from 'react'

import { flushPendingPreferenceWrites } from '../utils/pendingPreferenceWrites'
import { consumeSettingsTakeoverEntry } from './useSettingsModal'

export const useSignOut = () => {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    await flushPendingPreferenceWrites()
    // Before signOut, because the RPC needs a live session. The next person on this browser
    // then gets no pushes for this account.
    if (isPushSupported()) await unregisterPushSubscription()
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
