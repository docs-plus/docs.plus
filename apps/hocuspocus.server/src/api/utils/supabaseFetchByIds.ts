import { supabaseRest } from './supabase'

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
