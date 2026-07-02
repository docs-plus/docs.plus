/**
 * Admin media storage — fleet quota audit for the chat media bucket.
 *
 * One fleet RPC per list/export request; summary is derived from that fleet
 * (SQL summary RPC only when the fleet is empty, for quota_bytes).
 */

import { z } from 'zod'

import {
  type MediaStorageQuery,
  type WorkspaceMediaStorageStat,
  workspaceMediaStorageStatSchema,
  type WorkspaceMediaStorageSummary,
  workspaceMediaStorageSummarySchema
} from '../../schemas/admin.schema'
import { getSupabaseClient } from '../utils/supabase'

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

export type { MediaStorageQuery, WorkspaceMediaStorageStat, WorkspaceMediaStorageSummary }

const fleetRowsSchema = z.array(workspaceMediaStorageStatSchema)
const EXPORT_ROW_CAP = 10_000

type ListResult =
  | {
      status: 'ok'
      summary: WorkspaceMediaStorageSummary
      data: WorkspaceMediaStorageStat[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }
  | { status: 'error'; message: string }

type SummaryResult =
  | { status: 'ok'; data: WorkspaceMediaStorageSummary }
  | { status: 'error'; message: string }

export async function fetchFleetRows(
  supabase: AdminClient
): Promise<
  { status: 'ok'; data: WorkspaceMediaStorageStat[] } | { status: 'error'; message: string }
> {
  const { data, error } = await supabase.rpc('get_all_workspace_media_storage_stats')
  if (error) return { status: 'error', message: error.message }

  const parsed = fleetRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid media storage fleet payload' }
  }
  return { status: 'ok', data: parsed.data }
}

function computeSummaryFromFleet(rows: WorkspaceMediaStorageStat[]): WorkspaceMediaStorageSummary {
  let totalBytes = 0
  let totalObjects = 0
  let overQuotaCount = 0
  for (const row of rows) {
    totalBytes += row.total_bytes
    totalObjects += row.object_count
    if (row.usage_percent >= 100) overQuotaCount += 1
  }
  return {
    total_bytes: totalBytes,
    total_objects: totalObjects,
    workspace_count: rows.length,
    over_quota_count: overQuotaCount,
    quota_bytes: rows[0]?.quota_bytes ?? 0
  }
}

async function resolveFleetSummary(
  supabase: AdminClient,
  fleet: WorkspaceMediaStorageStat[]
): Promise<SummaryResult> {
  if (fleet.length > 0) {
    return { status: 'ok', data: computeSummaryFromFleet(fleet) }
  }
  return getMediaStorageSummary(supabase)
}

function applyListQuery(
  rows: WorkspaceMediaStorageStat[],
  query: MediaStorageQuery
): WorkspaceMediaStorageStat[] {
  const needle = (query.search ?? '').trim().toLowerCase()
  const filtered = needle
    ? rows.filter(
        (row) =>
          row.workspace_id.toLowerCase().includes(needle) ||
          (row.name?.toLowerCase().includes(needle) ?? false) ||
          (row.slug?.toLowerCase().includes(needle) ?? false)
      )
    : rows

  const dir = query.sortDir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    switch (query.sortBy) {
      case 'name':
        return dir * (a.name ?? '').localeCompare(b.name ?? '')
      case 'slug':
        return dir * (a.slug ?? '').localeCompare(b.slug ?? '')
      case 'object_count':
        return dir * (a.object_count - b.object_count)
      case 'total_bytes':
        return dir * (a.total_bytes - b.total_bytes)
      case 'quota_bytes':
        return dir * (a.quota_bytes - b.quota_bytes)
      case 'usage_percent':
        return dir * (a.usage_percent - b.usage_percent)
      default: {
        const _exhaustive: never = query.sortBy
        return _exhaustive
      }
    }
  })
}

export async function getMediaStorageSummary(supabase: AdminClient): Promise<SummaryResult> {
  const { data, error } = await supabase.rpc('get_workspace_media_storage_summary')
  if (error) return { status: 'error', message: error.message }

  const parsed = workspaceMediaStorageSummarySchema.safeParse(data)
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid media storage summary payload' }
  }
  return { status: 'ok', data: parsed.data }
}

export async function listMediaStorage(
  supabase: AdminClient,
  query: MediaStorageQuery
): Promise<ListResult> {
  const fleet = await fetchFleetRows(supabase)
  if (fleet.status === 'error') return fleet

  const summaryResult = await resolveFleetSummary(supabase, fleet.data)
  if (summaryResult.status === 'error') return summaryResult

  const prepared = applyListQuery(fleet.data, query)

  if (query.scope === 'all') {
    if (prepared.length > EXPORT_ROW_CAP) {
      return {
        status: 'error',
        message: `Export exceeds ${EXPORT_ROW_CAP} rows; narrow your search`
      }
    }
    return {
      status: 'ok',
      summary: summaryResult.data,
      data: prepared,
      pagination: {
        page: 1,
        limit: prepared.length,
        total: prepared.length,
        totalPages: prepared.length === 0 ? 0 : 1
      }
    }
  }

  const page = parseInt(query.page, 10)
  const limit = Math.min(parseInt(query.limit, 10), 100)
  const total = prepared.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * limit

  return {
    status: 'ok',
    summary: summaryResult.data,
    data: prepared.slice(start, start + limit),
    pagination: { page: safePage, limit, total, totalPages }
  }
}
