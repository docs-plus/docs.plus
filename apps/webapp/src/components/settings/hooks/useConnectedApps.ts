import type { OAuthGrant } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { groupApps } from '@utils/appTrust'
import { fetchGrantRedirects } from '@utils/connectedApps'
import { supabaseClient } from '@utils/supabase'

export const CONNECTED_APPS_QUERY_KEY = ['connected-apps'] as const

async function fetchGrants(): Promise<OAuthGrant[]> {
  const { data, error } = await supabaseClient.auth.oauth.listGrants()
  if (error) throw error
  return data ?? []
}

async function fetchConnectedApps() {
  const [grants, redirects] = await Promise.all([fetchGrants(), fetchGrantRedirects()])
  return { grants, redirects }
}

/** The signed-in person's OAuth grants, grouped by app and trust state, newest first. */
export function useConnectedApps() {
  return useQuery({
    queryKey: CONNECTED_APPS_QUERY_KEY,
    queryFn: fetchConnectedApps,
    select: groupApps,
    retry: 1
  })
}
