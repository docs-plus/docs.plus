import type { Logger } from 'pino'

import type { RedisClient } from '../../../types/redis.types'
import type { McpUsage, RecordUsage } from '../types'

export const MCP_USAGE_MAX_DAYS = 35
const TTL_SECONDS = MCP_USAGE_MAX_DAYS * 24 * 60 * 60

const utcDay = (date: Date): string => date.toISOString().slice(0, 10)

const keysFor = (day: string) => ({
  usage: `mcp:usage:${day}`,
  clients: `mcp:clients:${day}`,
  callers: `mcp:callers:${day}`
})

/** Counts only: tool, outcome, app and a distinct-caller estimate. Never arguments or text. */
export const createUsageRecorder = (redis: RedisClient | null, logger: Logger): RecordUsage => {
  if (!redis) return () => {}
  return ({ tool, outcome, clientId, sub }) => {
    // The shared client queues commands while offline, so an outage would pile up writes.
    if (redis.status !== 'ready') return
    const warn = (err: unknown) => logger.warn({ err }, 'MCP usage count failed')
    // `run()` calls this in a `finally`, so a sync throw would replace the tool's result.
    try {
      const keys = keysFor(utcDay(new Date()))
      redis
        .pipeline()
        .hincrby(keys.usage, `${tool}:${outcome}`, 1)
        .hincrby(keys.clients, clientId, 1)
        .pfadd(keys.callers, sub)
        .expire(keys.usage, TTL_SECONDS, 'NX')
        .expire(keys.clients, TTL_SECONDS, 'NX')
        .expire(keys.callers, TTL_SECONDS, 'NX')
        .exec()
        .then((results) => {
          const err = results?.find(([error]) => error)?.[0]
          if (err) warn(err)
        })
        .catch(warn)
    } catch (err) {
      warn(err)
    }
  }
}

/** Null when Redis is missing, so the page never shows zeros as real data. */
export const readMcpUsage = async (
  redis: RedisClient | null,
  dayCount: number,
  now = new Date()
): Promise<McpUsage | null> => {
  if (!redis) return null
  const days = Array.from({ length: dayCount }, (_, i) =>
    utcDay(new Date(now.getTime() - (dayCount - 1 - i) * 86_400_000))
  )
  const pipeline = redis.pipeline()
  for (const day of days) {
    const keys = keysFor(day)
    pipeline.hgetall(keys.usage).hgetall(keys.clients).pfcount(keys.callers)
  }
  pipeline.pfcount(...days.map((day) => keysFor(day).callers))
  const results = await pipeline.exec()
  if (!results) return null
  const failed = results.find(([error]) => error)?.[0]
  if (failed) throw failed

  const value = (index: number) => results[index]?.[1]
  const tools = new Map<string, number>()
  const clientCalls: Record<string, number> = {}
  const perDay = days.map((day, i) => {
    const usage = value(i * 3) as Record<string, string>
    const clients = value(i * 3 + 1) as Record<string, string>
    let calls = 0
    for (const [field, count] of Object.entries(usage)) {
      calls += Number(count)
      tools.set(field, (tools.get(field) ?? 0) + Number(count))
    }
    for (const [clientId, count] of Object.entries(clients)) {
      clientCalls[clientId] = (clientCalls[clientId] ?? 0) + Number(count)
    }
    return { day, calls, callers: Number(value(i * 3 + 2)) }
  })

  return {
    days: perDay,
    callers: Number(value(days.length * 3)),
    tools: [...tools].map(([field, calls]) => {
      const split = field.lastIndexOf(':')
      return { tool: field.slice(0, split), outcome: field.slice(split + 1), calls }
    }),
    clientCalls
  }
}
