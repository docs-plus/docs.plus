/**
 * Swarm Host allowlist + Actor cap enforcement.
 * See root CONTEXT.md §Document swarm for `Swarm Host` / `Actor cap` glossary.
 */

export type SwarmHostKind = 'local'

export class SwarmHostRefusedError extends Error {}
export class ActorCapExceededError extends Error {}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])
const LOCAL_HOSTNAME_SUFFIX = '.local'

export const ACTOR_CAP_LOCAL = 20

export function classifySwarmHost(rawUrl: string): SwarmHostKind {
  let hostname: string
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase()
  } catch {
    throw new SwarmHostRefusedError(`Swarm Target URL is not a valid URL: "${rawUrl}"`)
  }

  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(LOCAL_HOSTNAME_SUFFIX)) return 'local'

  throw new SwarmHostRefusedError(
    `Swarm Host "${hostname}" is not allowlisted. Allowed hosts: localhost, 127.0.0.1, *.local. Production hosts are refused by design.`
  )
}

const ACTOR_CAPS: Record<SwarmHostKind, number> = { local: ACTOR_CAP_LOCAL }

export function actorCapFor(hostKind: SwarmHostKind): number {
  return ACTOR_CAPS[hostKind]
}

export function assertWithinActorCap(users: number, hostKind: SwarmHostKind, force: boolean): void {
  const cap = actorCapFor(hostKind)
  if (!force && users > cap) {
    throw new ActorCapExceededError(
      `Requested ${users} Swarm Actors exceeds the ${hostKind} Actor cap (${cap}). Pass --force to override.`
    )
  }
}

/** Refuses disallowed Swarm Hosts and over-cap Swarm Actor counts in one call. */
export function assertAllowedSwarmHost(
  rawUrl: string,
  users: number,
  force: boolean
): SwarmHostKind {
  const hostKind = classifySwarmHost(rawUrl)
  assertWithinActorCap(users, hostKind, force)
  return hostKind
}
