import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: {
    database: 'ok' | 'error'
    websocket: 'ok' | 'error'
  }
  memory: {
    used: number
    free: number
    total: number
    percentage: number
  }
  pm2?: {
    processId: number
    instance: number
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheck | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const startTime = Date.now()

    // Memory usage
    const memUsage = process.memoryUsage()
    const totalMem = require('os').totalmem()
    const freeMem = require('os').freemem()
    const usedMem = totalMem - freeMem

    // Database health check
    let dbStatus: 'ok' | 'error' = 'ok'
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        await supabase.from('profiles').select('count').limit(1).single()
      }
    } catch (dbError) {
      console.error('Database health check failed:', dbError)
      dbStatus = 'error'
    }

    // WebSocket health check (simplified)
    let wsStatus: 'ok' | 'error' = 'ok'
    try {
      // Add your WebSocket health check logic here
      // For now, just check if the environment variable exists
      if (!process.env.NEXT_PUBLIC_PROVIDER_URL) {
        wsStatus = 'error'
      }
    } catch (wsError) {
      console.error('WebSocket health check failed:', wsError)
      wsStatus = 'error'
    }

    // Overall status determination
    let overallStatus: 'ok' | 'degraded' | 'error' = 'ok'
    if (dbStatus === 'error' || wsStatus === 'error') {
      overallStatus = memUsage.heapUsed > memUsage.heapTotal * 0.9 ? 'error' : 'degraded'
    }

    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '2.0.0-beta.103',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbStatus,
        websocket: wsStatus
      },
      memory: {
        used: Math.round(usedMem / 1024 / 1024), // MB
        free: Math.round(freeMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100)
      }
    }

    // Add PM2 info if available
    if (process.env.PM2_USAGE) {
      healthCheck.pm2 = {
        processId: parseInt(process.env.PM2_USAGE) || 0,
        instance: parseInt(process.env.NODE_APP_INSTANCE || '0')
      }
    }

    // Set response status based on health
    const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503

    // Add response time header
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

    res.status(statusCode).json(healthCheck)
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Service unavailable'
    })
  }
}
