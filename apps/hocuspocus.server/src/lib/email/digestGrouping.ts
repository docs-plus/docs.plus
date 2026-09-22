import type { RedisClient } from '../../types'
import type { DigestGrouping } from './digestDocuments'

const KEY = 'email:digest-grouping'
const MAX_KB_KEY = 'email:digest-max-kb'

export const DEFAULT_DIGEST_MAX_KB = 90
export const DIGEST_MAX_KB_MIN = 10
export const DIGEST_MAX_KB_MAX = 102

/** Missing Redis or an unknown value stays on one mail per document. */
export async function readDigestGrouping(redis: RedisClient | null): Promise<DigestGrouping> {
  if (!redis) return 'document'
  try {
    const value = await redis.get(KEY)
    return value === 'aggregate' ? 'aggregate' : 'document'
  } catch {
    return 'document'
  }
}

/** A missing or unreadable value stays at 90KB, under Gmail's clip. */
export async function readDigestMaxKb(redis: RedisClient | null): Promise<number> {
  if (!redis) return DEFAULT_DIGEST_MAX_KB
  try {
    const value = Number(await redis.get(MAX_KB_KEY))
    if (!Number.isInteger(value) || value < DIGEST_MAX_KB_MIN || value > DIGEST_MAX_KB_MAX) {
      return DEFAULT_DIGEST_MAX_KB
    }
    return value
  } catch {
    return DEFAULT_DIGEST_MAX_KB
  }
}

export async function writeDigestMaxKb(redis: RedisClient, maxKb: number): Promise<void> {
  await redis.set(MAX_KB_KEY, String(maxKb))
}

export async function writeDigestGrouping(
  redis: RedisClient,
  grouping: DigestGrouping
): Promise<void> {
  await redis.set(KEY, grouping)
}
