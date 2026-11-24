import { describe, expect, test } from 'bun:test'
import pino from 'pino'

import { metricsText, rateLimitFailOpenTotal, seedRestAlertSeries } from '../../../../lib/metrics'
import type { RedisClient } from '../../../../types/redis.types'
import { createRequestBudget, createToolBudget } from '../../infra/toolBudget'

const logger = pino({ level: 'silent' })

const makeFailingRedis = (): RedisClient =>
  ({
    defineCommand: () => {},
    rlflxIncr: async () => {
      throw new Error('redis down')
    }
  }) as unknown as RedisClient

const metricValue = async (bucket: string, reason: string): Promise<number> => {
  const metric = await rateLimitFailOpenTotal.get()
  const entry = metric.values.find((v) => v.labels.bucket === bucket && v.labels.reason === reason)
  return entry?.value ?? 0
}

describe('toolBudget fail-open metrics', () => {
  test('increments rateLimitFailOpenTotal when Redis fails on mcp-sub and mcp-req', async () => {
    const redis = makeFailingRedis()
    const subBudget = createToolBudget(redis, logger)
    const reqBudget = createRequestBudget(redis, logger)

    const beforeSub = await metricValue('mcp-sub', 'store-error')
    const beforeReq = await metricValue('mcp-req', 'store-error')

    expect(await subBudget('user-1')).toEqual({ ok: true })
    expect(await reqBudget('user-1')).toEqual({ ok: true })

    expect(await metricValue('mcp-sub', 'store-error')).toBe(beforeSub + 1)
    expect(await metricValue('mcp-req', 'store-error')).toBe(beforeReq + 1)
  })

  test('seedRestAlertSeries initializes mcp-sub, mcp-req, and mcp-auth-503 fail-open series', async () => {
    seedRestAlertSeries()
    const text = await metricsText()

    for (const bucket of ['mcp-sub', 'mcp-req', 'mcp-auth-503']) {
      for (const reason of ['timeout', 'store-error']) {
        expect(text).toContain(`rate_limit_fail_open_total{reason="${reason}",bucket="${bucket}"}`)
      }
    }
  })
})
