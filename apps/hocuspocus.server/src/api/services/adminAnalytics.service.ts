/**
 * Admin Analytics Service — Supabase RPC reads for view/retention metrics,
 * with optional Prisma title enrichment. Each function returns the RPC result
 * (or throws); controllers map errors to HTTP responses.
 */

import type { PrismaClient } from '@prisma/client'

import { getSupabaseClient } from '../utils/supabase'

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

/** Invoke a Supabase RPC, with optional args. Returns the raw `{ data, error }`. */
export function callRpc(supabase: AdminClient, rpcName: string, args?: Record<string, unknown>) {
  return args ? supabase.rpc(rpcName, args) : supabase.rpc(rpcName)
}

/** Map slugs to their Prisma titles for analytics enrichment. */
async function titleMapForSlugs(
  prisma: PrismaClient,
  slugs: string[]
): Promise<Map<string, string | null>> {
  if (slugs.length === 0) return new Map()
  const docs = await prisma.documentMetadata.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, title: true }
  })
  return new Map(docs.map((d) => [d.slug, d.title]))
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

  const slugs = (data || []).map((d: { document_slug: string }) => d.document_slug)
  const titleMap = await titleMapForSlugs(prisma, slugs)
  const enriched = (data || []).map(
    (d: { document_slug: string; views: number; unique_users: number }) => ({
      ...d,
      title: titleMap.get(d.document_slug) || d.document_slug
    })
  )
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

  const { data, error } = await supabase
    .from('document_views_daily')
    .select('document_slug, view_date, views')
    .in('document_slug', slugs)
    .gte('view_date', startDateStr)
    .order('view_date', { ascending: true })
  if (error) return { error }

  const dateMap: Record<string, Record<string, number>> = {}
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    dateMap[dateStr] = {}
    slugs.forEach((slug) => {
      dateMap[dateStr][slug] = 0
    })
  }

  ;(data || []).forEach((row: { document_slug: string; view_date: string; views: number }) => {
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

  const slugs = (data || []).map((d: { document_slug: string }) => d.document_slug)
  const titleMap = await titleMapForSlugs(prisma, slugs)
  const enriched = (data || []).map(
    (d: { document_slug: string; message_count: number; unique_users: number }) => ({
      ...d,
      title: titleMap.get(d.document_slug) || d.document_slug
    })
  )
  return { data: enriched }
}
