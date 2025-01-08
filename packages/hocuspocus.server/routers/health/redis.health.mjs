import { createClient as createRedisClient } from 'redis'
import expressRouter from '../../utils/router.mjs'
const router = expressRouter()

export const checkRedisHealth = async (redis) => {
  // First check if Redis is configured
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    return { status: 'disabled' }
  }

  // If redis client is not provided, return unhealthy
  if (!redis) {
    return {
      status: 'unhealthy',
      error: 'Redis client not initialized'
    }
  }

  try {
    await redis.ping()
    return { status: 'healthy' }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    }
  }
}

router.get('/', async (req, res) => {
  // Get redis client from app.locals
  const redis = req.app.locals.redis
  const health = await checkRedisHealth(redis)

  // Set appropriate status code
  res.status(health.status === 'healthy' ? 200 : 503)
  return health
})

export default router.expressRouter
