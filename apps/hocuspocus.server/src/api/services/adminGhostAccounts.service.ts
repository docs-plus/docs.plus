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

export type AuthUser = {
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
 * The one gate before any erasure. The ghost list is cached, so re-read the user,
 * who may have signed in since. An owner request skips only the ghost check. Refuse an
 * unknown id here: the profile update matches zero rows without an error. Refuse admins:
 * a hard delete cascades past the last-admin guard. A read fault throws.
 */
async function ghostDeleteRefusal(
  store: AccountStore,
  userId: string,
  policy: ErasurePolicy
): Promise<string | null> {
  const user = await store.readAuthUser(userId)
  if (!user) return 'User not found'
  if (policy === 'ghost' && !classifyGhost(user, 0)) return 'User is no longer a ghost account'
  return (await store.isAdmin(userId)) ? 'User is an admin' : null
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

const deletedUsername = (id: string): string => `deleted_${id.replace(/-/g, '').slice(0, 12)}`

async function removeAvatarObjects(client: AdminClient, userId: string): Promise<void> {
  const bucket = client.storage.from(AVATAR_BUCKET)
  const { data, error } = await bucket.list(userId)
  if (error) throw error
  if (!data || data.length === 0) return
  const removed = await bucket.remove(data.map((file) => `${userId}/${file.name}`))
  if (removed.error) throw removed.error
}

export type SoftDeleteOutcome =
  | { id: string; status: 'ok' }
  | { id: string; status: 'failed'; error: string }
  | { id: string; status: 'incomplete'; steps: string[] }

/**
 * The `users` read policies are `USING (true)`, so a flag alone leaves the
 * profile public. Clear the row first, so no render points at a deleted avatar.
 * Push and email go off explicitly: `push_enabled` defaults to true. A failed
 * avatar, ban, push or queued-email step is logged and returned as `incomplete`.
 */
async function softDeleteUsers(
  client: AdminClient,
  userIds: string[]
): Promise<SoftDeleteOutcome[]> {
  const now = new Date().toISOString()
  return Promise.all(
    userIds.map(async (id) => {
      const { error } = await client
        .from('users')
        .update({
          full_name: null,
          avatar_url: null,
          avatar_updated_at: null,
          profile_data: {},
          notification_preferences: { email_enabled: false, push_enabled: false },
          username: deletedUsername(id)
        })
        .eq('id', id)
      if (error) return { id, status: 'failed', error: error.message }

      // First write wins, so a retry keeps the original deletion time.
      const stamp = await client
        .from('users')
        .update({ deleted_at: now })
        .eq('id', id)
        .is('deleted_at', null)
      if (stamp.error) return { id, status: 'failed', error: stamp.error.message }

      const [avatars, ban, pushRows, queuedEmail] = await Promise.allSettled([
        removeAvatarObjects(client, id),
        client.auth.admin.updateUserById(id, { ban_duration: '876600h' }),
        client.from('push_subscriptions').delete().eq('user_id', id),
        client.from('email_queue').delete().eq('user_id', id).eq('status', 'pending')
      ])
      const steps: string[] = []
      if (avatars.status === 'rejected') {
        adminLogger.error({ err: avatars.reason, userId: id }, 'Failed to remove avatar objects')
        steps.push('avatar removal')
      }
      const banError = ban.status === 'rejected' ? ban.reason : ban.value.error
      if (banError) {
        adminLogger.error({ err: banError, userId: id }, 'Failed to ban soft-deleted user')
        steps.push('ban')
      }
      const pushError = pushRows.status === 'rejected' ? pushRows.reason : pushRows.value.error
      if (pushError) {
        adminLogger.error({ err: pushError, userId: id }, 'Failed to remove push subscriptions')
        steps.push('push subscription removal')
      }
      const emailError =
        queuedEmail.status === 'rejected' ? queuedEmail.reason : queuedEmail.value.error
      if (emailError) {
        adminLogger.error({ err: emailError, userId: id }, 'Failed to remove queued email')
        steps.push('queued email removal')
      }
      return steps.length > 0 ? { id, status: 'incomplete', steps } : { id, status: 'ok' }
    })
  )
}

export type ErasurePolicy = 'ghost' | 'owner_request'

export type ErasureOutcome =
  | { id: string; status: 'refused'; reason: string }
  | { id: string; status: 'failed'; error: unknown }
  | { id: string; status: 'incomplete'; steps: string[] }
  | { id: string; status: 'soft_deleted'; reason?: string }
  | { id: string; status: 'hard_deleted' }

export type UnfinishedErasure = Extract<
  ErasureOutcome,
  { status: 'refused' | 'failed' | 'incomplete' }
>

/** Every read and write erasure needs. Each method throws on a fault it cannot report. */
export interface AccountStore {
  /** Null for an unknown id. */
  readAuthUser(id: string): Promise<AuthUser | null>
  isAdmin(id: string): Promise<boolean>
  readImpact(id: string): Promise<GhostDeletionImpact>
  /** Live documents per owner, in one read. */
  ownedDocumentCounts(ids: string[]): Promise<Map<string, number>>
  /** One outcome per id, in input order. */
  softDelete(ids: string[]): Promise<SoftDeleteOutcome[]>
  hardDelete(id: string): Promise<void>
}

export function supabaseAccountStore(client: AdminClient, prisma: PrismaClient): AccountStore {
  return {
    async readAuthUser(id) {
      const { data, error } = await client.auth.admin.getUserById(id)
      if (error && error.status !== 404) throw error
      return error || !data.user ? null : (data.user as AuthUser)
    },
    async isAdmin(id) {
      const admin = await client
        .from('admin_users')
        .select('user_id')
        .eq('user_id', id)
        .maybeSingle()
      if (admin.error) throw admin.error
      return !!admin.data
    },
    async readImpact(id) {
      const read = await getGhostDeletionImpact(client, id)
      if ('error' in read) throw new Error(read.error)
      return read.impact
    },
    // Documents live in Postgres, so the Supabase impact RPC cannot see them.
    async ownedDocumentCounts(ids) {
      const rows = await prisma.documentMetadata.groupBy({
        by: ['ownerId'],
        where: { ownerId: { in: ids }, deletedAt: null },
        _count: { _all: true }
      })
      return new Map(rows.flatMap((row) => (row.ownerId ? [[row.ownerId, row._count._all]] : [])))
    },
    softDelete: (ids) => softDeleteUsers(client, ids),
    async hardDelete(id) {
      const { error } = await client.auth.admin.deleteUser(id)
      if (error) throw new Error(error.message)
    }
  }
}

export const isUnfinishedErasure = (o: ErasureOutcome): o is UnfinishedErasure =>
  o.status === 'refused' || o.status === 'failed' || o.status === 'incomplete'

/** The one text for an erasure that did not finish. */
export function erasureFailureText(o: UnfinishedErasure): string {
  if (o.status === 'refused') return o.reason
  if (o.status === 'incomplete') return `${o.steps.join(' and ')} failed`
  return o.error instanceof Error ? o.error.message : 'Unknown error'
}

/**
 * One outcome per id, duplicates kept: refusals and read faults, then soft, then hard, each
 * group in input order. A ghost with blocking messages or live documents is soft, so they keep
 * an owner. An owner request is always soft. A batch counts every id, even with none admitted.
 * A count or soft-delete throw rejects the call. Any outcome but `failed` refreshes the list.
 */
export async function eraseAccounts(
  store: AccountStore,
  policy: ErasurePolicy,
  rawIds: string[],
  { batch = false }: { batch?: boolean } = {}
): Promise<ErasureOutcome[]> {
  // Prisma compares ownerId as text, so an uppercase id would count no documents.
  const ids = rawIds.map((id) => id.toLowerCase())
  const outcomes: ErasureOutcome[] = []
  const admitted: { id: string; impact?: GhostDeletionImpact }[] = []

  const checks = await Promise.all(
    ids.map(async (id): Promise<ErasureOutcome | (typeof admitted)[number]> => {
      try {
        const reason = await ghostDeleteRefusal(store, id, policy)
        if (reason) return { id, status: 'refused', reason }
        return policy === 'ghost' ? { id, impact: await store.readImpact(id) } : { id }
      } catch (error) {
        return { id, status: 'failed', error }
      }
    })
  )
  for (const check of checks) {
    if ('status' in check) outcomes.push(check)
    else admitted.push(check)
  }

  const owned =
    policy === 'ghost' && (batch || admitted.length > 0)
      ? await store.ownedDocumentCounts(ids)
      : new Map<string, number>()

  const soft: { id: string; reason?: string }[] = []
  const hard: string[] = []
  for (const { id, impact } of admitted) {
    const documents = owned.get(id) ?? 0
    if (policy === 'owner_request') soft.push({ id })
    else if (documents > 0)
      soft.push({
        id,
        reason: `User owns ${documents} document(s) — soft-deleted + banned so they keep an owner`
      })
    else if (impact?.has_blocking_messages)
      soft.push({
        id,
        reason: `User has ${impact.message_count} messages — soft-deleted + banned to preserve history`
      })
    else hard.push(id)
  }

  if (soft.length > 0) {
    const results = await store.softDelete(soft.map((s) => s.id))
    results.forEach((r, i) => {
      if (r.status === 'ok')
        outcomes.push({ id: r.id, status: 'soft_deleted', reason: soft[i].reason })
      else if (r.status === 'failed')
        outcomes.push({ id: r.id, status: 'failed', error: new Error(r.error) })
      else outcomes.push(r)
    })
  }

  for (const id of hard) {
    try {
      await store.hardDelete(id)
      outcomes.push({ id, status: 'hard_deleted' })
    } catch (error) {
      outcomes.push({ id, status: 'failed', error })
    }
  }
  if (outcomes.some((o) => o.status !== 'failed')) invalidateGhostCaches()
  return outcomes
}
