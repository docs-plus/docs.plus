import type { Context } from 'hono'
import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import * as healthService from '../services/health.service'

export const checkOverallHealth = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const redis = c.get('redis') as Redis | null

  const result = await healthService.checkAllServices(prisma, redis)
  const statusCode = result.status === 'ok' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkDatabaseHealth = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const result = await healthService.checkDatabaseHealth(prisma)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkRedisHealth = async (c: any) => {
  const redis = c.get('redis') as Redis | null
  const result = await healthService.checkRedisHealth(redis)
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}

export const checkSupabaseHealth = async (c: any) => {
  const result = await healthService.checkSupabaseHealth()
  const statusCode = result.status === 'healthy' ? 200 : 503

  return c.json(result, statusCode)
}
