/**
 * Unit tests for Prisma connection pooling
 */

import { describe, test, expect } from 'bun:test'

describe('Prisma Connection Pool Configuration', () => {
  test('should export prisma client and pool helpers', () => {
    // Dynamic import to avoid initialization errors
    const poolModule = require('../../src/lib/prisma')

    // The PrismaPg adapter now owns the pg Pool internally, so the module
    // no longer exports a `pool` directly — stats flow through getPoolStats.
    expect(poolModule.prisma).toBeDefined()
    expect(poolModule.pool).toBeUndefined()
    expect(poolModule.getPoolStats).toBeDefined()
    expect(poolModule.checkDatabaseHealth).toBeDefined()
  })

  test('should have getPoolStats function that returns pool statistics', () => {
    const { getPoolStats } = require('../../src/lib/prisma')

    const stats = getPoolStats()

    expect(stats).toBeDefined()
    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('idle')
    expect(stats).toHaveProperty('waiting')
    expect(stats).toHaveProperty('active')
    expect(stats).toHaveProperty('max')
    expect(stats).toHaveProperty('utilization')

    expect(typeof stats.total).toBe('number')
    expect(typeof stats.idle).toBe('number')
    expect(typeof stats.waiting).toBe('number')
    expect(typeof stats.active).toBe('number')
    expect(typeof stats.max).toBe('number')
    expect(typeof stats.utilization).toBe('number')
  })

  test('should report pool capacity derived from configuration', () => {
    // The adapter owns the pool, so capacity is surfaced via getPoolStats
    // rather than a direct pool reference. total/max reflect the configured size.
    const { getPoolStats } = require('../../src/lib/prisma')

    const stats = getPoolStats()

    expect(stats.max).toBeGreaterThan(0)
    expect(stats.total).toBe(stats.max)
  })

  test('pool stats should show initial idle connections', () => {
    const { getPoolStats } = require('../../src/lib/prisma')

    const stats = getPoolStats()

    // Initially, all connections should be idle or none created yet
    expect(stats.total).toBeGreaterThanOrEqual(0)
    expect(stats.idle).toBeGreaterThanOrEqual(0)
    expect(stats.waiting).toBe(0)
  })
})
