import { describe, expect, test } from 'bun:test'

import type { RedisClient } from '../../types/redis.types'
import { revertCooldownTotal } from '../metrics'
import { createRevertCooldown, REVERT_COOLDOWN_MS } from '../revertCooldown'

// The Redis arm and the fleet-wide claim are proved by scripts/e2e-backend-limits.ts,
// which runs two real processes. This file covers the fallback arm, which is what
// answers when Redis is absent or wedged, and it needs no infrastructure.
describe('revert cooldown — local fallback arm', () => {
  test('refuses a second revert on the same document inside the window', async () => {
    const cooldown = createRevertCooldown(null)
    expect(await cooldown.coolingDown('doc-a')).toBe(false)
    expect(await cooldown.coolingDown('doc-a')).toBe(true)
  })

  test('holds one budget per document, not one overall', async () => {
    const cooldown = createRevertCooldown(null)
    expect(await cooldown.coolingDown('doc-a')).toBe(false)
    expect(await cooldown.coolingDown('doc-b')).toBe(false)
  })

  test('allows the next revert once the window passes', async () => {
    const cooldown = createRevertCooldown(null)
    expect(await cooldown.coolingDown('doc-c')).toBe(false)
    await Bun.sleep(REVERT_COOLDOWN_MS + 50)
    expect(await cooldown.coolingDown('doc-c')).toBe(false)
  })

  test('each instance keeps its own map, which is the divergence the Redis arm fixes', async () => {
    const one = createRevertCooldown(null)
    const two = createRevertCooldown(null)
    expect(await one.coolingDown('doc-d')).toBe(false)
    expect(await two.coolingDown('doc-d')).toBe(false)
  })
})

// A store client that answers nothing real. Every consume rejects with a plain
// Error, which is exactly the store-error arm, and it needs no Redis.
const brokenRedis = { defineCommand: () => {} } as unknown as RedisClient

const outcomeCount = async (outcome: string): Promise<number> => {
  const metric = await revertCooldownTotal.get()
  return metric.values.find((value) => value.labels.outcome === outcome)?.value ?? 0
}

describe('revert cooldown — degraded arm', () => {
  test('a store fault still limits through the map, and is counted rather than silent', async () => {
    const before = await outcomeCount('degraded-store-error')
    const cooldown = createRevertCooldown(brokenRedis)

    expect(await cooldown.coolingDown('doc-e')).toBe(false)
    expect(await cooldown.coolingDown('doc-e')).toBe(true)
    expect(await outcomeCount('degraded-store-error')).toBe(before + 2)
  })
})
