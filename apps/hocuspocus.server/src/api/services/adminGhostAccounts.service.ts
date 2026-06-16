/**
 * Admin Ghost-Accounts Service — auth-user classification, caching, and
 * smart-delete operations.
 *
 * Ghost classification pages the entire auth.users base and cross-references
 * public.users, so the classified set is cached per minAgeDays within a TTL to
 * avoid re-paging on each admin view.
 */

import { adminLogger } from '../../lib/logger'
import { getSupabaseClient } from '../utils/supabase'

const CACHE_TTL_MS = 5 * 60 * 1000

// Cap on auth.users we page through per refresh. Supabase Admin listUsers maxes
// at 1000/page; this bounds total pages so one admin load cannot stall on a
// runaway user base. Logged (not silent) when reached.
const MAX_AUTH_USERS = 50000
const AUTH_PAGE_SIZE = 1000

export type GhostType =
  | 'unconfirmed_magic_link'
  | 'abandoned_sso'
  | 'stale_unconfirmed'
  | 'never_signed_in'
  | 'no_public_profile'
  | 'stale_anonymous'
  | 'orphaned_anonymous'

export interface GhostAccount {
  id: string
  email: string | null
  provider: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  is_anonymous: boolean
  age_days: number
  ghost_type: GhostType
  has_public_profile: boolean
}

type AuthUser = {
  id: string
  email?: string
  created_at: string
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
  is_anonymous?: boolean
  app_metadata?: Record<string, unknown>
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseClient>>

/** Page through auth.users up to MAX_AUTH_USERS, logging if the cap is reached. */
async function fetchAllAuthUsers(client: AdminClient): Promise<AuthUser[]> {
  const allUsers: AuthUser[] = []
  let page = 1

  while (allUsers.length < MAX_AUTH_USERS) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw error
    allUsers.push(...(data.users as AuthUser[]))
    if (data.users.length < AUTH_PAGE_SIZE) break
    page++
  }

  if (allUsers.length >= MAX_AUTH_USERS) {
    adminLogger.warn(
      { cap: MAX_AUTH_USERS },
      'Auth-user cap hit — ghost classification covers only the first MAX_AUTH_USERS users'
    )
  }
  return allUsers
}

function classifyGhost(
  user: AuthUser,
  hasPublicProfile: boolean,
  minAgeDays: number
): GhostType | null {
  const isAnon = user.is_anonymous || user.app_metadata?.provider === 'anonymous'
  const ageDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)

  if (isAnon) {
    if (ageDays > 90) return 'orphaned_anonymous'
    if (ageDays > 30) return 'stale_anonymous'
    return null
  }

  if (ageDays < minAgeDays) return null

  const provider = (user.app_metadata?.provider as string) || 'email'
  if (!user.email_confirmed_at && provider === 'email') return 'unconfirmed_magic_link'
  if (!user.email_confirmed_at && provider === 'google' && !user.last_sign_in_at)
    return 'abandoned_sso'
  if (!user.email_confirmed_at && ageDays > 30) return 'stale_unconfirmed'
  if (!user.last_sign_in_at) return 'never_signed_in'
  if (!hasPublicProfile) return 'no_public_profile'
  return null
}

// Cache the classified ghost set per minAgeDays so paging/summary within the TTL
// doesn't re-page the entire user base on each admin view.
interface ClassifiedGhosts {
  ghosts: GhostAccount[]
  totalAuthUsers: number
}
const MAX_GHOST_CACHE = 50 // minAgeDays is a small int set; cap guards against unbounded growth
const ghostCache = new Map<number, { data: ClassifiedGhosts; expiresAt: number }>()

async function classifyAllGhosts(
  client: AdminClient,
  minAgeDays: number
): Promise<ClassifiedGhosts> {
  const cached = ghostCache.get(minAgeDays)
  if (cached && Date.now() < cached.expiresAt) return cached.data

  const [authUsers, publicUsersResult] = await Promise.all([
    fetchAllAuthUsers(client),
    client.from('users').select('id')
  ])
  const publicUserIds = new Set(publicUsersResult.data?.map((u: { id: string }) => u.id) || [])

  const ghosts: GhostAccount[] = []
  for (const user of authUsers) {
    const hasProfile = publicUserIds.has(user.id)
    const ghostType = classifyGhost(user, hasProfile, minAgeDays)
    if (!ghostType) continue
    ghosts.push({
      id: user.id,
      email: user.email || null,
      provider: (user.app_metadata?.provider as string) || 'unknown',
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      is_anonymous: user.is_anonymous || false,
      age_days: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000),
      ghost_type: ghostType,
      has_public_profile: hasProfile
    })
  }
  ghosts.sort((a, b) => b.age_days - a.age_days)

  const data: ClassifiedGhosts = { ghosts, totalAuthUsers: authUsers.length }
  if (ghostCache.size >= MAX_GHOST_CACHE) ghostCache.clear()
  ghostCache.set(minAgeDays, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

export interface GhostListParams {
  minAgeDays: number
  ghostType: string | null
  page: number
  perPage: number
}

export interface GhostListResult {
  ghosts: GhostAccount[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export async function listGhostAccounts(
  client: AdminClient,
  params: GhostListParams
): Promise<GhostListResult> {
  const { minAgeDays, ghostType, page, perPage } = params
  const { ghosts } = await classifyAllGhosts(client, minAgeDays)

  const filtered = ghostType ? ghosts.filter((g) => g.ghost_type === ghostType) : ghosts
  const start = (page - 1) * perPage
  const paged = filtered.slice(start, start + perPage)

  return {
    ghosts: paged,
    total: filtered.length,
    page,
    perPage,
    totalPages: Math.ceil(filtered.length / perPage)
  }
}

export interface GhostSummaryResult {
  total_ghosts: number
  total_auth_users: number
  oldest_ghost_days: number
  by_type: Record<string, number>
  public_users: unknown
}

export async function getGhostSummary(client: AdminClient): Promise<GhostSummaryResult> {
  const [classified, publicResult] = await Promise.all([
    classifyAllGhosts(client, 7),
    client.rpc('get_ghost_summary_public')
  ])

  const counts: Record<string, number> = {
    unconfirmed_magic_link: 0,
    abandoned_sso: 0,
    stale_unconfirmed: 0,
    never_signed_in: 0,
    no_public_profile: 0,
    stale_anonymous: 0,
    orphaned_anonymous: 0
  }
  let oldestDays = 0
  for (const ghost of classified.ghosts) {
    counts[ghost.ghost_type]++
    if (ghost.age_days > oldestDays) oldestDays = ghost.age_days
  }

  const publicSummary = Array.isArray(publicResult.data) ? publicResult.data[0] : publicResult.data

  return {
    total_ghosts: classified.ghosts.length,
    total_auth_users: classified.totalAuthUsers,
    oldest_ghost_days: oldestDays,
    by_type: counts,
    public_users: publicSummary || {
      total_public_users: 0,
      never_active_count: 0,
      soft_deleted_count: 0,
      active_count: 0
    }
  }
}

/** Stale anonymous users older than minAgeDays, reusing the paged auth fetch. */
export async function fetchStaleAnonymous(
  client: AdminClient,
  minAgeDays: number
): Promise<AuthUser[]> {
  const users = await fetchAllAuthUsers(client)
  return users.filter((u) => {
    if (!u.is_anonymous) return false
    const ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000)
    return ageDays >= minAgeDays
  })
}

/** Invalidate ghost caches after delete/cleanup so counts reflect removals. */
export function invalidateGhostCaches(): void {
  ghostCache.clear()
}

export interface GhostDeletionImpact {
  message_count?: number
  channel_memberships?: number
  push_subscriptions?: number
  email_queue_items?: number
  notifications_received?: number
  has_blocking_messages?: boolean
}

const EMPTY_GHOST_IMPACT: Required<GhostDeletionImpact> = {
  message_count: 0,
  channel_memberships: 0,
  push_subscriptions: 0,
  email_queue_items: 0,
  notifications_received: 0,
  has_blocking_messages: false
}

async function fetchGhostDeletionImpact(
  client: AdminClient,
  userId: string
): Promise<GhostDeletionImpact | null> {
  const { data } = await client.rpc('get_user_deletion_impact', { p_user_id: userId })
  return (Array.isArray(data) ? data[0] : data) ?? null
}

export async function getGhostDeletionImpact(
  client: AdminClient,
  userId: string | undefined
): Promise<{ error: unknown } | { impact: GhostDeletionImpact }> {
  const { data, error } = await client.rpc('get_user_deletion_impact', { p_user_id: userId })
  if (error) return { error }
  const impact = Array.isArray(data) ? data[0] : data
  return { impact: impact || EMPTY_GHOST_IMPACT }
}

export type DeleteGhostResult =
  | { status: 'soft_delete'; reason: string }
  | { status: 'hard_delete' }
  | { status: 'error'; message: string }

/**
 * Smart-delete one ghost account. Soft-delete (deleted_at + ban) preserves
 * history when the user has blocking messages; otherwise hard-delete cascades.
 */
export async function deleteGhostAccount(
  client: AdminClient,
  userId: string
): Promise<DeleteGhostResult> {
  const row = await fetchGhostDeletionImpact(client, userId)
  const hasBlocking = row?.has_blocking_messages ?? false

  if (hasBlocking) {
    const [updateResult, banResult] = await Promise.all([
      client.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId),
      client.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
    ])

    if (updateResult.error) return { status: 'error', message: updateResult.error.message }
    if (banResult.error)
      adminLogger.error({ err: banResult.error }, 'Failed to ban soft-deleted user')

    invalidateGhostCaches()
    return {
      status: 'soft_delete',
      reason: `User has ${row?.message_count} messages — soft-deleted + banned to preserve history`
    }
  }

  const { error } = await client.auth.admin.deleteUser(userId)
  if (error) return { status: 'error', message: error.message }

  invalidateGhostCaches()
  return { status: 'hard_delete' }
}

export interface BulkDeleteGhostResult {
  hard_deleted: number
  soft_deleted: number
  failed: number
  errors: string[]
}

/** Bulk smart-delete: soft-delete users with blocking messages, hard-delete the rest. */
export async function bulkDeleteGhostAccounts(
  client: AdminClient,
  userIds: string[]
): Promise<BulkDeleteGhostResult> {
  const results: BulkDeleteGhostResult = { hard_deleted: 0, soft_deleted: 0, failed: 0, errors: [] }

  const impactResults = await Promise.all(
    userIds.map(async (userId: string) => {
      try {
        const impact = await fetchGhostDeletionImpact(client, userId)
        return { userId, impact }
      } catch {
        return { userId, impact: null }
      }
    })
  )

  const hardDeleteIds: string[] = []
  const softDeleteIds: string[] = []
  for (const { userId, impact } of impactResults) {
    if (!impact) {
      hardDeleteIds.push(userId)
      continue
    }
    if (impact.has_blocking_messages) softDeleteIds.push(userId)
    else hardDeleteIds.push(userId)
  }

  if (softDeleteIds.length > 0) {
    const now = new Date().toISOString()
    const { error: updateErr } = await client
      .from('users')
      .update({ deleted_at: now })
      .in('id', softDeleteIds)

    if (updateErr) {
      results.failed += softDeleteIds.length
      results.errors.push(`Soft-delete batch failed: ${updateErr.message}`)
    } else {
      await Promise.allSettled(
        softDeleteIds.map((id) => client.auth.admin.updateUserById(id, { ban_duration: '876600h' }))
      )
      results.soft_deleted = softDeleteIds.length
    }
  }

  for (const userId of hardDeleteIds) {
    try {
      const { error } = await client.auth.admin.deleteUser(userId)
      if (error) {
        results.failed++
        results.errors.push(`${userId}: ${error.message}`)
      } else {
        results.hard_deleted++
      }
    } catch (err) {
      results.failed++
      results.errors.push(`${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  invalidateGhostCaches()
  return results
}
