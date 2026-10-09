/**
 * Ghost types come from auth.users alone. `no_public_profile` was removed:
 * handle_new_user always creates the profile, so a login without one is a
 * trigger bug, never an account to delete.
 */

import type { PrismaClient } from '@prisma/client'

import { adminLogger } from '../../lib/logger'
import { getSupabaseClient } from '../utils/supabase'

const CACHE_TTL_MS = 5 * 60 * 1000

// Cap on auth.users we page through per refresh. Supabase Admin listUsers maxes
// at 1000/page; this bounds total pages so one admin load cannot stall on a
// runaway user base. Logged (not silent) when reached.
const MAX_AUTH_USERS = 50000
const AUTH_PAGE_SIZE = 1000
// Must match the bucket that packages/supabase/scripts/12-buckets.sql creates.
const AVATAR_BUCKET = 'user_avatars'

export type GhostType =
  | 'unconfirmed_magic_link'
  | 'abandoned_sso'
  | 'stale_unconfirmed'
  | 'never_signed_in'
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

function classifyGhost(user: AuthUser, minAgeDays: number): GhostType | null {
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
  return null
}

/**
 * The one gate before a ghost delete. The list is cached, so re-read the user,
 * who may have signed in since. Refuse admins: a hard delete cascades past the
 * last-admin guard. Returns the refusal reason, or null. A read fault throws.
 */
async function assertDeletableGhost(client: AdminClient, userId: string): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(userId)
  if (error || !data.user) return 'User not found'
  if (!classifyGhost(data.user as AuthUser, 0)) return 'User is no longer a ghost account'

  const admin = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (admin.error) throw admin.error
  if (admin.data) return 'User is an admin'
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

  const authUsers = await fetchAllAuthUsers(client)

  const ghosts: GhostAccount[] = []
  for (const user of authUsers) {
    const ghostType = classifyGhost(user, minAgeDays)
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
      ghost_type: ghostType
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

// A successful read with no row means no dependents.
export async function getGhostDeletionImpact(
  client: AdminClient,
  userId: string | undefined
): Promise<{ error: string } | { impact: GhostDeletionImpact }> {
  const { data, error } = await client.rpc('get_user_deletion_impact', { p_user_id: userId })
  if (error) return { error: error.message }
  const impact = Array.isArray(data) ? data[0] : data
  return { impact: impact || EMPTY_GHOST_IMPACT }
}

export type DeleteGhostResult =
  | { status: 'soft_delete'; reason: string }
  | { status: 'hard_delete' }
  | { status: 'refused'; reason: string }
  | { status: 'error'; message: string }

const deletedUsername = (id: string): string => `deleted_${id.replace(/-/g, '').slice(0, 12)}`

async function removeAvatarObjects(client: AdminClient, userId: string): Promise<void> {
  const bucket = client.storage.from(AVATAR_BUCKET)
  const { data, error } = await bucket.list(userId)
  if (error) throw error
  if (!data || data.length === 0) return
  const removed = await bucket.remove(data.map((file) => `${userId}/${file.name}`))
  if (removed.error) throw removed.error
}

/**
 * Every user soft delete goes through here. The `users` read policies are
 * `USING (true)`, so a flag alone leaves the profile public. The row is cleared
 * first, so a render never points at a deleted avatar. Avatar and ban failures log only.
 */
async function softDeleteUsers(
  client: AdminClient,
  userIds: string[]
): Promise<{ id: string; error?: string }[]> {
  const now = new Date().toISOString()
  return Promise.all(
    userIds.map(async (id) => {
      const { error } = await client
        .from('users')
        .update({
          deleted_at: now,
          full_name: null,
          avatar_url: null,
          avatar_updated_at: null,
          profile_data: {},
          username: deletedUsername(id)
        })
        .eq('id', id)
      if (error) return { id, error: error.message }

      const [avatars, ban] = await Promise.allSettled([
        removeAvatarObjects(client, id),
        client.auth.admin.updateUserById(id, { ban_duration: '876600h' })
      ])
      if (avatars.status === 'rejected')
        adminLogger.error({ err: avatars.reason, userId: id }, 'Failed to remove avatar objects')
      const banError = ban.status === 'rejected' ? ban.reason : ban.value.error
      if (banError)
        adminLogger.error({ err: banError, userId: id }, 'Failed to ban soft-deleted user')
      return { id }
    })
  )
}

/**
 * Smart-delete one ghost account. A user with blocking messages or owned documents
 * is soft-deleted: banned, with the profile and avatar cleared. Any other user is
 * hard-deleted. A failed ghost check or impact read deletes nothing.
 */
export async function deleteGhostAccount(
  client: AdminClient,
  prisma: PrismaClient,
  rawUserId: string
): Promise<DeleteGhostResult> {
  // Prisma compares ownerId as text, so an uppercase id would count no documents.
  const userId = rawUserId.toLowerCase()
  const refusal = await assertDeletableGhost(client, userId)
  if (refusal) {
    invalidateGhostCaches()
    return { status: 'refused', reason: refusal }
  }

  const read = await getGhostDeletionImpact(client, userId)
  if ('error' in read) return { status: 'error', message: read.error }
  const { impact } = read

  // Documents live in Postgres, not Supabase, so get_user_deletion_impact cannot
  // see them. Hard-deleting an owner leaves ownerId pointing at nothing, and an
  // ownerless private document is one no endpoint can ever open or delete again.
  const ownedDocuments = await prisma.documentMetadata.count({
    where: { ownerId: userId, deletedAt: null }
  })
  const hasBlocking = !!impact.has_blocking_messages || ownedDocuments > 0

  if (hasBlocking) {
    const [result] = await softDeleteUsers(client, [userId])
    if (result.error) return { status: 'error', message: result.error }

    invalidateGhostCaches()
    return {
      status: 'soft_delete',
      reason:
        ownedDocuments > 0
          ? `User owns ${ownedDocuments} document(s) — soft-deleted + banned so they keep an owner`
          : `User has ${impact.message_count} messages — soft-deleted + banned to preserve history`
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

export async function bulkDeleteGhostAccounts(
  client: AdminClient,
  prisma: PrismaClient,
  rawUserIds: string[]
): Promise<BulkDeleteGhostResult> {
  const userIds = rawUserIds.map((id) => id.toLowerCase())
  const results: BulkDeleteGhostResult = { hard_deleted: 0, soft_deleted: 0, failed: 0, errors: [] }

  // Ids are capped at 50 by ghostBulkDeleteSchema. A refused id, a failed impact
  // read, or a throw counts as failed and is never deleted.
  const checks = await Promise.all(
    userIds.map(async (userId: string) => {
      try {
        const refusal = await assertDeletableGhost(client, userId)
        if (refusal) return { userId, error: refusal }
        const read = await getGhostDeletionImpact(client, userId)
        if ('error' in read) return { userId, error: read.error }
        return { userId, impact: read.impact }
      } catch (err) {
        return { userId, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    })
  )

  // One grouped count for the batch: documents are invisible to the Supabase
  // impact RPC, and an owner hard-deleted here leaves documents nobody can reach.
  const ownerRows = await prisma.documentMetadata.groupBy({
    by: ['ownerId'],
    where: { ownerId: { in: userIds }, deletedAt: null },
    _count: { _all: true }
  })
  const owners = new Set(ownerRows.map((row) => row.ownerId).filter((id): id is string => !!id))

  const hardDeleteIds: string[] = []
  const softDeleteIds: string[] = []
  for (const check of checks) {
    if ('error' in check) {
      results.failed++
      results.errors.push(`${check.userId}: ${check.error}`)
      continue
    }
    if (owners.has(check.userId) || check.impact.has_blocking_messages) {
      softDeleteIds.push(check.userId)
    } else {
      hardDeleteIds.push(check.userId)
    }
  }

  for (const { id, error } of await softDeleteUsers(client, softDeleteIds)) {
    if (error) {
      results.failed++
      results.errors.push(`${id}: ${error}`)
    } else {
      results.soft_deleted++
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
