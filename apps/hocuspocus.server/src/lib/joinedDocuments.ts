import { AppError } from './errors'
import { getServiceRoleClient } from './supabase'

// PostgREST caps a response at max_rows (packages/supabase/config.toml).
const PAGE_SIZE = 1000

const unavailable = () =>
  new AppError('Joined documents are unavailable', 503, 'SERVICE_UNAVAILABLE')

/**
 * The documentIds the user holds an active membership on, by exact-case `workspace_id`.
 * Throws on a missing client or a read error and never returns `[]` for one: an empty
 * set would paint a false "No joined documents yet".
 */
export const getJoinedDocumentIds = async (userId: string): Promise<string[]> => {
  const client = getServiceRoleClient()
  if (!client) throw unavailable()

  const ids: string[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('workspace_members')
      .select('workspace_id')
      .eq('member_id', userId)
      .is('left_at', null)
      .order('workspace_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw unavailable()

    const rows = data as { workspace_id: string }[]
    for (const row of rows) ids.push(row.workspace_id)
    if (rows.length < PAGE_SIZE) return ids
  }
}
