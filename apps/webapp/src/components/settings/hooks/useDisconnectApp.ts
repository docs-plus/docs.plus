import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { CONNECTED_APPS_QUERY_KEY } from './useConnectedApps'

async function revokeAll(clientIds: string[]): Promise<void> {
  const results = await Promise.all(
    clientIds.map((clientId) => supabaseClient.auth.oauth.revokeGrant({ clientId }))
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

/** Revokes every client in one app group. The list refetches even after a partial failure. */
export function useDisconnectApp() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { clientIds: string[] }>({
    mutationFn: ({ clientIds }) => revokeAll(clientIds),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONNECTED_APPS_QUERY_KEY })
  })
}
