/**
 * Unit tests for Prisma connection pooling
 */

import { describe, test, expect } from 'bun:test'

describe('Prisma Connection Pool Configuration', () => {
  test('should export pool and prisma client', () => {
    // Dynamic import to avoid initialization errors
    const poolModule = require('../../src/lib/prisma')

    expect(poolModule.prisma).toBeDefined()
    expect(poolModule.pool).toBeDefined()
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

    expect(typeof stats.total).toBe('number')
    expect(typeof stats.idle).toBe('number')
    expect(typeof stats.waiting).toBe('number')
  })

  test('should configure pool with environment variables or defaults', () => {
    // Pool config is created at module load time
    // We can verify the pool exists and has expected properties
    const { pool } = require('../../src/lib/prisma')

    expect(pool).toBeDefined()
    expect(pool.totalCount).toBeDefined()
    expect(pool.idleCount).toBeDefined()
    expect(pool.waitingCount).toBeDefined()
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
