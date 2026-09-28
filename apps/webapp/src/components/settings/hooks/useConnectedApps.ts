import type { OAuthGrant } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { displayClientName } from '@utils/displayClientName'
import { supabaseClient } from '@utils/supabase'

import type { ConnectedAppGroup } from '../types'

export const CONNECTED_APPS_QUERY_KEY = ['connected-apps'] as const

async function fetchGrants(): Promise<OAuthGrant[]> {
  const { data, error } = await supabaseClient.auth.oauth.listGrants()
  if (error) throw error
  return data ?? []
}

function groupByName(grants: OAuthGrant[]): ConnectedAppGroup[] {
  const groups = new Map<string, ConnectedAppGroup>()
  for (const grant of grants) {
    const name = displayClientName(grant.client.name ?? '')
    const group = groups.get(name)
    if (!group) {
      groups.set(name, { name, clientIds: [grant.client.id], grantedAt: grant.granted_at })
      continue
    }
    group.clientIds.push(grant.client.id)
    if (grant.granted_at > group.grantedAt) group.grantedAt = grant.granted_at
  }
  return [...groups.values()].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
}

/** The signed-in person's OAuth grants, grouped by app name, newest first. */
export function useConnectedApps() {
  return useQuery({
    queryKey: CONNECTED_APPS_QUERY_KEY,
    queryFn: fetchGrants,
    select: groupByName,
    retry: 1
  })
}
