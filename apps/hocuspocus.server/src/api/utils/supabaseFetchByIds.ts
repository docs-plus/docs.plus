import { supabaseRest } from './supabase'

// One GET carries the ids in its URL. Kong answers 414 near 8 KB, so 100
// 36-character UUIDs (about 4.3 KB once quoted) leaves room (#578).
const IDS_PER_REQUEST = 100

export async function fetchByIds(
  table: string,
  column: string,
  ids: string[],
  select: string
): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let start = 0; start < ids.length; start += IDS_PER_REQUEST) {
    const quoted = ids
      .slice(start, start + IDS_PER_REQUEST)
      .map((id) => `"${id}"`)
      .join(',')
    const res = await supabaseRest(`${table}?${column}=in.(${quoted})&select=${select}`)
    // Throw, never return []: the stale purge reads an empty view-stats list as
    // "never viewed" and would erase live documents (#578). One failed chunk fails the read.
    if (!res) throw new Error('Supabase URL or service-role key is not set')
    if (!res.ok) throw new Error(`Supabase read of ${table} failed with status ${res.status}`)

    const json = await res.json()
    if (!Array.isArray(json)) throw new Error(`Supabase read of ${table} returned a non-array body`)
    rows.push(...json)
  }
  return rows
}
