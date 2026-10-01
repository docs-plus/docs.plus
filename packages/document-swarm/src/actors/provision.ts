import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

import type { ProvisionOptions } from '../config.ts'
import type { ActorRecord } from '../types.ts'
import { requireEnv } from './env.ts'
import { readActorsFile } from './loadActors.ts'

const ACTOR_EMAIL_DOMAIN = 'docs.plus.local'
const LIST_USERS_PAGE_SIZE = 1000

// Deterministic so a run can sign in (and re-provision self-heal) without the file;
// these are throwaway local/stage identities, never real accounts.
const PASSWORD_SUFFIX = 'Sw@rm-4ctor-2026'

function actorEmail(index: number): string {
  return `swarm-actor-${index}@${ACTOR_EMAIL_DOMAIN}`
}

function actorPassword(index: number): string {
  return `swarm-actor-${index}-${PASSWORD_SUFFIX}`
}

function actorDisplayName(index: number): string {
  return `Swarm Actor ${index}`
}

// `full_name`/`name` feed handle_new_user (username + profile name); `display_name` is a belt-and-braces alias.
function actorUserMetadata(displayName: string): Record<string, string> {
  return { full_name: displayName, name: displayName, display_name: displayName }
}

function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )
}

async function listActorUsersByEmail(admin: SupabaseClient): Promise<Map<string, User>> {
  const byEmail = new Map<string, User>()
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE })
    if (result.error) throw new Error(`Failed to list existing users: ${result.error.message}`)
    for (const user of result.data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user)
    }
    if (result.data.users.length < LIST_USERS_PAGE_SIZE) break
  }
  return byEmail
}

type EnsureOutcome = 'created' | 'adopted'

async function ensureActor(
  admin: SupabaseClient,
  index: number,
  existingByEmail: Map<string, User>
): Promise<{ record: ActorRecord; outcome: EnsureOutcome }> {
  const email = actorEmail(index)
  const password = actorPassword(index)
  const displayName = actorDisplayName(index)
  const metadata = actorUserMetadata(displayName)
  const existing = existingByEmail.get(email.toLowerCase())

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata
    })
    if (error) throw new Error(`Failed to refresh Swarm Actor ${email}: ${error.message}`)
    return { record: { email, password, userId: existing.id, displayName }, outcome: 'adopted' }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata
  })
  if (error || !data.user) {
    throw new Error(
      `Failed to create Swarm Actor ${email}: ${error?.message ?? 'no user returned'}`
    )
  }
  return { record: { email, password, userId: data.user.id, displayName }, outcome: 'created' }
}

/**
 * Idempotent Admin API provision. Every record is re-read from Auth, because a
 * `db reset` gives the same emails new ids and a stale file seeds wrong owners.
 * `--force` shrinks the pool to `count`; otherwise a larger pool keeps its size.
 */
export async function provision(options: ProvisionOptions): Promise<void> {
  const { count, actorsFile, force } = options
  const admin = createAdminClient()

  const fileCount = force ? 0 : ((await readActorsFile(actorsFile)) ?? []).length
  const poolSize = Math.max(count, fileCount)
  const existingByEmail = await listActorUsersByEmail(admin)

  const records: ActorRecord[] = []
  let created = 0
  let adopted = 0
  for (let index = 1; index <= poolSize; index++) {
    const { record, outcome } = await ensureActor(admin, index, existingByEmail)
    records.push(record)
    if (outcome === 'created') created++
    else adopted++
  }

  await Bun.write(actorsFile, `${JSON.stringify(records, null, 2)}\n`)
  console.log(
    `Swarm Actors ready → ${actorsFile}: pool ${records.length}, requested ${count} ` +
      `(created ${created}, adopted ${adopted} existing).`
  )
}
