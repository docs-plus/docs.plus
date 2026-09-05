import { Hono } from 'hono'

import * as healthController from '../controllers/health.controller'

const health = new Hono()

// Dependency check. The admin dashboard and the blackbox probe read this one.
health.get('/', healthController.checkOverallHealth)

// Liveness for the edge probe. Named apart from `/` because it answers a
// different question: is this process up, not is every dependency reachable.
health.get('/live', healthController.checkLiveness)

// Individual health check routes
health.get('/database', healthController.checkDatabaseHealth)
health.get('/redis', healthController.checkRedisHealth)
health.get('/supabase', healthController.checkSupabaseHealth)
health.get('/push', healthController.checkPushHealth)

export default health
