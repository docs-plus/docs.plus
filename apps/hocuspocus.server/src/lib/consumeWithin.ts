import { type RateLimiterAbstract, RateLimiterRes } from 'rate-limiter-flexible'

/**
 * The result of one bounded `consume`. Callers decide for themselves what
 * `unavailable` means, because the two callers in this repository answer it in
 * opposite ways, and neither answer belongs inside a shared primitive.
 */
export type ConsumeOutcome =
  { kind: 'allowed'; res: RateLimiterRes } | { kind: 'limited'; res: RateLimiterRes } | Unavailable

type Unavailable =
  | { kind: 'unavailable'; reason: 'timeout' }
  | { kind: 'unavailable'; reason: 'store-error'; error: unknown }

export type ReadOutcome = { kind: 'read'; res: RateLimiterRes | null } | Unavailable

const TIMED_OUT = Symbol('rate-limit-consume-timed-out')

// A slow Redis is not a broken one, so the catch arm below never fires for it.
// The shared 60s REDIS_COMMAND_TIMEOUT is then the only bound on the caller.
// Measured p99 consume is 0.39ms. The budget clears the 100ms event-loop lag the
// SLO accepts and the 200ms first Redis reconnect delay, which 150ms did not.
export const CONSUME_TIMEOUT_MS = 500

// Promise.race attaches its own handler to both inputs, so a late store-fault
// rejection is already handled. Measured. Only the timer needs clearing.
const withinTimeout = async <T>(work: Promise<T>): Promise<T | typeof TIMED_OUT> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), CONSUME_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

export const consumeWithin = async (
  limiter: RateLimiterAbstract,
  key: string
): Promise<ConsumeOutcome> => {
  try {
    const raced = await withinTimeout(limiter.consume(key))
    if (raced === TIMED_OUT) return { kind: 'unavailable', reason: 'timeout' }
    return { kind: 'allowed', res: raced }
  } catch (rejRes: unknown) {
    // A RateLimiterRes rejection is the budget answer, not a fault: the slot is
    // spent. A store fault rejects with a plain Error instead, and there is no
    // insuranceLimiter to absorb it.
    if (rejRes instanceof RateLimiterRes) return { kind: 'limited', res: rejRes }
    return { kind: 'unavailable', reason: 'store-error', error: rejRes }
  }
}

/** A bounded `get`, which spends nothing. `res` is null for a key with no points spent yet. */
export const readWithin = async (
  limiter: RateLimiterAbstract,
  key: string
): Promise<ReadOutcome> => {
  try {
    const raced = await withinTimeout(limiter.get(key))
    if (raced === TIMED_OUT) return { kind: 'unavailable', reason: 'timeout' }
    return { kind: 'read', res: raced }
  } catch (error: unknown) {
    return { kind: 'unavailable', reason: 'store-error', error }
  }
}
