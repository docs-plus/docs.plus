import expressRouter from '../../utils/router.mjs'
import { checkDatabaseHealth } from './database.health.mjs'
import { checkRedisHealth } from './redis.health.mjs'
import { checkSupabaseHealth } from './supabase.health.mjs'

const router = expressRouter()

router.get('/', async (req, res) => {
  const { prisma, redis } = req.app.locals

  const health = {
    status: 'ok',
    timestamp: new Date(),
    services: {
      database: await checkDatabaseHealth(prisma),
      redis: await checkRedisHealth(redis),
      supabase: await checkSupabaseHealth()
    }
  }

  // If any service is unhealthy, mark overall status as degraded
  if (Object.values(health.services).some((service) => service.status === 'unhealthy')) {
    health.status = 'degraded'
  }

  res.status(health.status === 'ok' ? 200 : 503)
  return health
})

export default router.expressRouter
