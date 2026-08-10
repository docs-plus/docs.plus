/**
 * Supabase RPC reads for view/retention metrics, optionally enriched with Prisma
 * titles. Errors come back in the result rather than thrown; the controllers own
 * the mapping to HTTP.
 */

import { Prisma, type PrismaClient } from '@prisma/client'

import { getSupabaseClient } from '../utils/supabase'

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

const VIEWS_PAGE = 1000

/** Invoke a Supabase RPC, with optional args. Returns the raw `{ data, error }`. */
export function callRpc(supabase: AdminClient, rpcName: string, args?: Record<string, unknown>) {
  return args ? supabase.rpc(rpcName, args) : supabase.rpc(rpcName)
}

/**
 * A view stat's `document_slug` is lower(trim(documentId)), while documentId is
 * mixed-case. Both the match and the map key have to be lowercased, or the join
 * silently returns nothing.
 */
async function metaMapForSlugs(
  prisma: PrismaClient,
  slugs: string[]
): Promise<Map<string, { title: string | null; slug: string }>> {
  if (slugs.length === 0) return new Map()
  const docs = await prisma.$queryRaw<{ documentId: string; title: string | null; slug: string }[]>`
    SELECT "documentId", title, slug FROM "DocumentMetadata"
    WHERE lower("documentId") IN (${Prisma.join(slugs)})
  `
  return new Map(docs.map((d) => [d.documentId.toLowerCase(), { title: d.title, slug: d.slug }]))
}

export async function getTopViewedDocuments(
  supabase: AdminClient,
  prisma: PrismaClient,
  limit: number,
  days: number
) {
  const { data, error } = await supabase.rpc('get_top_viewed_documents', {
    p_limit: Math.min(limit, 50),
    p_days: Math.min(days, 90)
  })
  if (error) return { error }

  const rows = (data || []) as { document_slug: string; views: number; unique_users: number }[]
  const metaMap = await metaMapForSlugs(
    prisma,
    rows.map((d) => d.document_slug)
  )
  // `slug` is the human URL segment, and it is null when no metadata row resolves.
  // The UI can then avoid linking to a path that would open an empty draft instead.
  const enriched = rows.map((d) => {
    const meta = metaMap.get(d.document_slug)
    return { ...d, title: meta?.title || d.document_slug, slug: meta?.slug ?? null }
  })
  return { data: enriched }
}

export async function getBatchDocumentTrends(
  supabase: AdminClient,
  slugs: string[],
  days: number
): Promise<{ error: unknown } | { data: Record<string, number[]> }> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().split('T')[0]

  // slugs × days exceeds the 1000-row PostgREST cap on a wide table page, and a
  // dropped row renders as a zero rather than as an error. `document_slug` is the
  // tiebreaker that makes the sort key unique, so paging cannot skip a row.
  const rows: { document_slug: string; view_date: string; views: number }[] = []
  for (let from = 0; ; from += VIEWS_PAGE) {
    const { data, error } = await supabase
      .from('document_views_daily')
      .select('document_slug, view_date, views')
      .in('document_slug', slugs)
      .gte('view_date', startDateStr)
      .order('view_date', { ascending: true })
      .order('document_slug', { ascending: true })
      .range(from, from + VIEWS_PAGE - 1)
    if (error) return { error }

    const page = (data || []) as typeof rows
    rows.push(...page)
    if (page.length < VIEWS_PAGE) break
  }

  const dateMap: Record<string, Record<string, number>> = {}
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    dateMap[dateStr] = {}
    slugs.forEach((slug) => {
      dateMap[dateStr][slug] = 0
    })
  }

  rows.forEach((row) => {
    const dateStr =
      typeof row.view_date === 'string'
        ? row.view_date
        : new Date(row.view_date).toISOString().split('T')[0]
    if (dateMap[dateStr]) dateMap[dateStr][row.document_slug] = row.views
  })

  const sortedDates = Object.keys(dateMap).sort()
  const trendsBySlug: Record<string, number[]> = {}
  slugs.forEach((slug) => {
    trendsBySlug[slug] = sortedDates.map((date) => dateMap[date][slug] || 0)
  })
  return { data: trendsBySlug }
}

export async function getTopActiveDocuments(
  supabase: AdminClient,
  prisma: PrismaClient,
  limit: number,
  days: number
) {
  const { data, error } = await supabase.rpc('get_top_active_documents', {
    p_limit: Math.min(limit, 20),
    p_days: Math.min(days, 30)
  })
  if (error) return { error }

  const rows = (data || []) as {
    document_slug: string
    message_count: number
    unique_users: number
  }[]
  const metaMap = await metaMapForSlugs(
    prisma,
    rows.map((d) => d.document_slug)
  )
  const enriched = rows.map((d) => ({
    ...d,
    title: metaMap.get(d.document_slug)?.title || d.document_slug
  }))
  return { data: enriched }
}
