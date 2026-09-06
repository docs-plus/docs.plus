import type { Logger } from 'pino'

import type { RedisClient } from '../types/redis.types'

/** What the lease did, so a caller can count or log each arm separately. */
export type LeaseOutcome = 'ran' | 'skipped' | 'ran-unleased'

/**
 * Runs `work` on one process at a time across the fleet. The key expires instead
 * of being released, so a crashed holder cannot block forever and a second
 * replica's boot call cannot start a duplicate pass inside the same window.
 */
export const withRedisLease = async (
  redis: RedisClient,
  key: string,
  ttlSeconds: number,
  work: () => Promise<void>,
  logger?: Pick<Logger, 'warn' | 'debug'>
): Promise<LeaseOutcome> => {
  let acquired = false

  try {
    // The acquire is deliberately unbounded, unlike the 500 ms races in
    // `revertCooldown`. Nobody waits on this call, and a timeout would only reach
    // the unleased arm below sooner, so the fleet would run more duplicate passes.
    acquired = (await redis.set(key, String(process.pid), 'EX', ttlSeconds, 'NX')) === 'OK'
  } catch (err) {
    // A lease we cannot take is no reason to stop the work. Duplicated work is
    // wasteful; skipping it grows the backlog the work exists to bound.
    logger?.warn({ err, key }, 'Redis lease check failed, running unleased')
    await work()
    return 'ran-unleased'
  }

  if (!acquired) {
    logger?.debug({ key }, 'Another process holds the lease, skipping')
    return 'skipped'
  }

  await work()
  return 'ran'
}
