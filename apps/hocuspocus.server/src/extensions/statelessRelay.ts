/**
 * The relay arm mints one OutgoingMessage per connection, is reachable with no
 * credentials on any public room, and so is bounded by room size times burst
 * rate. The only client traffic here is `docTitle`, a few hundred bytes.
 */
export const MAX_STATELESS_RELAY_BYTES = 64 * 1024

/**
 * The relay has no authz, so a client-chosen envelope is a client-chosen server
 * event. The webapp follows `type:'private'` into a hard redirect, and reads
 * `msg` before any type. Every real server event broadcasts directly, not here.
 */
export const RELAYABLE_STATELESS_TYPES: ReadonlySet<string> = new Set(['docTitle'])

export type RelayVerdict =
  | { relay: true; body: string; bytes: number }
  | { relay: false; reason: 'type-not-allowed' }
  | { relay: false; reason: 'oversized'; bytes: number }

/**
 * The type check runs before the stringify, so a refused payload is never
 * serialised and an oversized forgery counts as a forgery rather than muddying
 * the OOM signal. `msg` is refused outright: the named branches own every
 * legitimate one.
 */
export const decideStatelessRelay = (payload: Record<string, unknown>): RelayVerdict => {
  if (
    payload.msg ||
    typeof payload.type !== 'string' ||
    !RELAYABLE_STATELESS_TYPES.has(payload.type)
  ) {
    return { relay: false, reason: 'type-not-allowed' }
  }

  const body = JSON.stringify(payload)
  const bytes = Buffer.byteLength(body)
  if (bytes > MAX_STATELESS_RELAY_BYTES) return { relay: false, reason: 'oversized', bytes }
  return { relay: true, body, bytes }
}
