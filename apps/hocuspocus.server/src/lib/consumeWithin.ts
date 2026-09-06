import { type RateLimiterAbstract, RateLimiterRes } from 'rate-limiter-flexible'

/**
 * The result of one bounded `consume`. Callers decide for themselves what
 * `unavailable` means, because the two callers in this repository answer it in
 * opposite ways, and neither answer belongs inside a shared primitive.
 */
export type ConsumeOutcome =
  | { kind: 'allowed'; res: RateLimiterRes }
  | { kind: 'limited'; res: RateLimiterRes }
  | { kind: 'unavailable'; reason: 'timeout' }
  | { kind: 'unavailable'; reason: 'store-error'; error: unknown }

const TIMED_OUT = Symbol('rate-limit-consume-timed-out')

// A slow Redis is not a broken one, so the catch arm below never fires for it.
// The shared 60s REDIS_COMMAND_TIMEOUT is then the only bound on the caller.
// Measured p99 consume is 0.39ms. The budget clears the 100ms event-loop lag the
// SLO accepts and the 200ms first Redis reconnect delay, which 150ms did not.
export const CONSUME_TIMEOUT_MS = 500

export const consumeWithin = async (
  limiter: RateLimiterAbstract,
  key: string
): Promise<ConsumeOutcome> => {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const raced = await Promise.race([
      limiter.consume(key),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), CONSUME_TIMEOUT_MS)
      })
    ])

    if (raced === TIMED_OUT) return { kind: 'unavailable', reason: 'timeout' }
    return { kind: 'allowed', res: raced }
  } catch (rejRes: unknown) {
    // A RateLimiterRes rejection is the budget answer, not a fault: the slot is
    // spent. A store fault rejects with a plain Error instead, and there is no
    // insuranceLimiter to absorb it.
    if (rejRes instanceof RateLimiterRes) return { kind: 'limited', res: rejRes }
    return { kind: 'unavailable', reason: 'store-error', error: rejRes }
  } finally {
    // Promise.race attaches its own handler to both inputs, so a late store-fault
    // rejection is already handled. Measured. Only the timer needs clearing.
    clearTimeout(timer)
  }
}
