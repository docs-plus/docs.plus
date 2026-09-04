import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useEffect } from 'react'

/** Failures stay silent — Last opened is best-effort. */
const useTouchDocumentOpened = (documentId?: string, ownerId?: string | null) => {
  const profileId = useAuthStore((state) => state.profile?.id)

  useEffect(() => {
    if (!documentId || !ownerId || !profileId || ownerId !== profileId) return

    let cancelled = false
    const run = async () => {
      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      if (!session?.access_token || cancelled) return
      await fetch(`${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/opened`, {
        method: 'POST',
        headers: { token: session.access_token }
      }).catch(() => undefined)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [documentId, ownerId, profileId])
}

export default useTouchDocumentOpened
