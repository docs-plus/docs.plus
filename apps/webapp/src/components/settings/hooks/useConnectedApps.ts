import type { OAuthGrant } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { groupApps, type Redirects } from '@utils/appTrust'
import { supabaseClient } from '@utils/supabase'

export const CONNECTED_APPS_QUERY_KEY = ['connected-apps'] as const

async function fetchGrants(): Promise<OAuthGrant[]> {
  const { data, error } = await supabaseClient.auth.oauth.listGrants()
  if (error) throw error
  return data ?? []
}

// Grants omit redirect URIs. Without them every app stays unverified, so a failure is not an error.
// The timeout keeps a hung backend from hiding every Disconnect button behind a pending query.
async function fetchRedirects(): Promise<Redirects> {
  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession()
    if (!session) return {}
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/connected-apps/redirects`,
      { headers: { token: session.access_token }, signal: AbortSignal.timeout(8_000) }
    )
    if (!response.ok) return {}
    const json = await response.json()
    return (json.data?.redirects ?? {}) as Redirects
  } catch {
    return {}
  }
}

async function fetchConnectedApps() {
  const [grants, redirects] = await Promise.all([fetchGrants(), fetchRedirects()])
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
