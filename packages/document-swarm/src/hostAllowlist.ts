/**
 * Swarm Host allowlist + Actor cap enforcement.
 * See root CONTEXT.md §Document swarm for `Swarm Host` / `Actor cap` glossary.
 */

export class SwarmHostRefusedError extends Error {}
export class ActorCapExceededError extends Error {}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])
const LOCAL_HOSTNAME_SUFFIX = '.local'

const ACTOR_CAP = 20

/** Refuses disallowed Swarm Hosts and over-cap Swarm Actor counts in one call. */
export function assertAllowedSwarmHost(rawUrl: string, users: number, force: boolean): void {
  let hostname: string
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase()
  } catch {
    throw new SwarmHostRefusedError(`Swarm Target URL is not a valid URL: "${rawUrl}"`)
  }

  if (!LOCAL_HOSTNAMES.has(hostname) && !hostname.endsWith(LOCAL_HOSTNAME_SUFFIX)) {
    throw new SwarmHostRefusedError(
      `Swarm Host "${hostname}" is not allowlisted. Allowed hosts: localhost, 127.0.0.1, *.local. Production hosts are refused by design.`
    )
  }

  if (!force && users > ACTOR_CAP) {
    throw new ActorCapExceededError(
      `Requested ${users} Swarm Actors exceeds the local Actor cap (${ACTOR_CAP}). Pass --force to override.`
    )
  }
}
