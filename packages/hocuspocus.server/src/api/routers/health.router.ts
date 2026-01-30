import { Hono } from 'hono'

import * as healthController from '../controllers/health.controller'

const health = new Hono()

// Main health check route
health.get('/', healthController.checkOverallHealth)

// Individual health check routes
health.get('/database', healthController.checkDatabaseHealth)
health.get('/redis', healthController.checkRedisHealth)
health.get('/supabase', healthController.checkSupabaseHealth)

export default health
