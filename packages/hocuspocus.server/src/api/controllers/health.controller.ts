import '../../types' // Import for type augmentation

import type { Context } from 'hono'

import * as healthService from '../services/health.service'

export const checkOverallHealth = async (c: Context) => {
  const prisma = c.get('prisma')
  const redis = c.get('redis')

  const result = await healthService.checkAllServices(prisma, redis)
  const statusCode = result.status === 'ok' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkDatabaseHealth = async (c: Context) => {
  const prisma = c.get('prisma')
  const result = await healthService.checkDatabaseHealth(prisma)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkRedisHealth = async (c: Context) => {
  const redis = c.get('redis')
  const result = await healthService.checkRedisHealth(redis)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkSupabaseHealth = async (c: Context) => {
  const result = await healthService.checkSupabaseHealth()
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}
