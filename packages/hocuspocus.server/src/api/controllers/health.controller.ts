import { pushGateway } from '../../lib/push'
import type { AppContext } from '../../types/hono.types'
import * as healthService from '../services/health.service'

export const checkOverallHealth = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const redis = c.get('redis')

  const result = await healthService.checkAllServices(prisma, redis)
  const statusCode = result.status === 'ok' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkDatabaseHealth = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const result = await healthService.checkDatabaseHealth(prisma)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkRedisHealth = async (c: AppContext): Promise<Response> => {
  const redis = c.get('redis')
  const result = await healthService.checkRedisHealth(redis)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkSupabaseHealth = async (c: AppContext): Promise<Response> => {
  const result = await healthService.checkSupabaseHealth()
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkPushHealth = async (c: AppContext): Promise<Response> => {
  const result = await pushGateway.getHealth()
  const statusCode = result.vapid_configured && result.queue_connected ? 200 : 503

  return c.json(result, statusCode)
}
