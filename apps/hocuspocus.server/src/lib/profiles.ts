import { documentsServiceLogger } from './logger'
import { getServiceRoleClient } from './supabase'

/**
 * The `public.users` columns every attribution surface renders, snake_case
 * preserved to mirror the table. Produced by `api/services/documents.service`
 * and injected, so no module selects these columns itself.
 */
export interface ProfileLite {
  id: string
  avatar_url: string | null
  avatar_updated_at: string | null
  full_name: string | null
  display_name: string | null
  status: string | null
}

export type GetOwnerProfiles = (userIds: string[]) => Promise<ProfileLite[]>

/** The exact column list every attribution surface reads. */
const OWNER_PROFILE_COLUMNS = 'id, avatar_url, avatar_updated_at, full_name, display_name, status'

/**
 * Contractually fail-soft: `[]` rather than a throw. Attribution decorates a
 * payload, and an outage must drop the names, never the request.
 */
export const getOwnerProfiles: GetOwnerProfiles = async (userIds) => {
  if (userIds.length === 0) return []
  const supabase = getServiceRoleClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('users')
    .select(OWNER_PROFILE_COLUMNS)
    .in('id', userIds)
  if (error) {
    documentsServiceLogger.warn(
      { err: error, count: userIds.length },
      'Owner profiles lookup failed'
    )
    return []
  }
  return (data ?? []) as ProfileLite[]
}

/** The singular twin, same table and same columns, so the two cannot drift apart. */
export const getOwnerProfile = async (userId: string): Promise<ProfileLite | null> => {
  const supabase = getServiceRoleClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select(OWNER_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    documentsServiceLogger.warn({ err: error, userId }, 'Owner profile lookup failed')
    return null
  }
  return (data ?? null) as ProfileLite | null
}

/** Every id an attribution row can name: the trigger, plus every contributor. */
export const distinctUserIds = (
  rows: { triggeredBy: string | null; contributors: string[] }[]
): string[] => {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.triggeredBy) ids.add(row.triggeredBy)
    for (const contributor of row.contributors) if (contributor) ids.add(contributor)
  }
  return [...ids]
}
