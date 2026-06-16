import { supabaseRest } from './supabase'

/**
 * Fetch PostgREST rows where `column` matches any of `ids`, returning the parsed
 * JSON array (or `[]` for empty ids / unconfigured client / non-array body).
 * Fetch and JSON errors propagate so each caller keeps its own try/catch + log.
 */
export async function fetchByIds(
  table: string,
  column: string,
  ids: string[],
  select: string
): Promise<unknown[]> {
  if (ids.length === 0) return []

  const quoted = ids.map((id) => `"${id}"`).join(',')
  const res = await supabaseRest(`${table}?${column}=in.(${quoted})&select=${select}`)
  if (!res) return []

  const json = await res.json()
  return Array.isArray(json) ? json : []
}
