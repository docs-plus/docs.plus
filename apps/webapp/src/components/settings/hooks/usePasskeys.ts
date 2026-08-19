import type { PasskeyListItem } from '@supabase/supabase-js'
import { isPasskeyDisabled, type PasskeyOutcome, toPasskeyOutcome } from '@utils/passkey'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect, useState } from 'react'

export interface UsePasskeysResult {
  passkeys: PasskeyListItem[]
  loading: boolean
  registering: boolean
  busyId: string | null
  /** Auth has passkeys turned off, so the card hides instead of offering a dead control. */
  unavailable: boolean
  register: () => Promise<PasskeyOutcome>
  rename: (passkeyId: string, friendlyName: string) => Promise<PasskeyOutcome>
  remove: (passkeyId: string) => Promise<PasskeyOutcome>
}

export function usePasskeys(): UsePasskeysResult {
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // A network blip must not hide the card; only Auth refusing passkeys does.
  const refresh = useCallback(async () => {
    const { data, error } = await supabaseClient.auth.passkey.list()
    if (isPasskeyDisabled(error)) setUnavailable(true)
    if (!error) setPasskeys(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const register = useCallback(async () => {
    setRegistering(true)
    try {
      const { error } = await supabaseClient.auth.registerPasskey()
      if (error) return toPasskeyOutcome(error, 'Could not add the passkey. Try again.')
      await refresh()
      return { status: 'ok' } as const
    } finally {
      setRegistering(false)
    }
  }, [refresh])

  const rename = useCallback(
    async (passkeyId: string, friendlyName: string) => {
      setBusyId(passkeyId)
      try {
        const { error } = await supabaseClient.auth.passkey.update({ passkeyId, friendlyName })
        if (error) return toPasskeyOutcome(error, 'Could not rename the passkey.')
        await refresh()
        return { status: 'ok' } as const
      } finally {
        setBusyId(null)
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async (passkeyId: string) => {
      setBusyId(passkeyId)
      try {
        const { error } = await supabaseClient.auth.passkey.delete({ passkeyId })
        if (error) return toPasskeyOutcome(error, 'Could not remove the passkey.')
        await refresh()
        return { status: 'ok' } as const
      } finally {
        setBusyId(null)
      }
    },
    [refresh]
  )

  return { passkeys, loading, registering, busyId, unavailable, register, rename, remove }
}
