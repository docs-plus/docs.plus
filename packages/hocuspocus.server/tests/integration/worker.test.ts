import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { spawn, type Subprocess } from 'bun'

describe('Worker Server - Integration Tests', () => {
  let workerProcess: Subprocess | null = null
  const WORKER_HEALTH_PORT = 3003

  // Helper to check if worker is responsive
  const checkWorkerHealth = async (retries = 10): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/health`, {
          signal: AbortSignal.timeout(1000)
        })
        if (response.ok) return true
      } catch {
        await Bun.sleep(500)
      }
    }
    return false
  }

  afterAll(async () => {
    if (workerProcess) {
      workerProcess.kill()
      await Bun.sleep(1000) // Wait for cleanup
    }
  })

  describe('Worker startup validation', () => {
    test('should fail to start without Redis configuration', async () => {
      const env = { ...process.env }
      delete env.REDIS_HOST
      delete env.REDIS_PORT

      const proc = spawn({
        cmd: ['bun', 'src/hocuspocus.worker.ts'],
        env,
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: '/Users/macbook/workspace/docsy/packages/hocuspocus.server'
      })

      const text = await new Response(proc.stdout).text()

      await Bun.sleep(500)

      // Should exit with code 1
      expect(proc.exitCode).toBe(1)
      expect(text).toContain('Redis is required')
    }, 10000)

    test('should start successfully with valid Redis configuration', async () => {
      // Only run if Redis is available
      if (!process.env.REDIS_HOST) {
        console.log('⚠️  Skipping worker startup test - Redis not configured')
        return
      }

      workerProcess = spawn({
        cmd: ['bun', 'src/hocuspocus.worker.ts'],
        env: {
          ...process.env,
          WORKER_HEALTH_PORT: WORKER_HEALTH_PORT.toString(),
          NODE_ENV: 'test',
          BULLMQ_CONCURRENCY: '2'
        },
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: '/Users/macbook/workspace/docsy/packages/hocuspocus.server'
      })

      // Wait for worker to start
      const isHealthy = await checkWorkerHealth(20)

      expect(isHealthy).toBe(true)
      expect(workerProcess.exitCode).toBe(null) // Still running
    }, 30000)
  })

  describe('Health check endpoints', () => {
    test('GET /health should return worker status', async () => {
      if (!process.env.REDIS_HOST) {
        console.log('⚠️  Skipping health check test - Redis not configured')
        return
      }

      if (!workerProcess) {
        console.log('⚠️  Worker not started, skipping test')
        return
      }

      const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/health`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('worker')
      expect(data.worker).toHaveProperty('running')
      expect(data.worker).toHaveProperty('paused')
      expect(data.worker).toHaveProperty('name')
      expect(data).toHaveProperty('services')
      expect(data.services).toHaveProperty('redis')
      expect(data.services).toHaveProperty('database')
    }, 10000)

    test('GET /health/ready should return 200 when worker is ready', async () => {
      if (!process.env.REDIS_HOST || !workerProcess) {
        console.log('⚠️  Skipping readiness test - Worker not available')
        return
      }

      const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/health/ready`)

      expect([200, 503]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data).toHaveProperty('status')
        expect(data.status).toBe('ready')
      }
    }, 10000)

    test('should handle non-existent endpoints with 404', async () => {
      if (!process.env.REDIS_HOST || !workerProcess) {
        console.log('⚠️  Skipping 404 test - Worker not available')
        return
      }

      const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/nonexistent`)

      expect(response.status).toBe(404)
    }, 10000)
  })

  describe('Worker metrics and monitoring', () => {
    test('health endpoint should show worker is running', async () => {
      if (!process.env.REDIS_HOST || !workerProcess) {
        console.log('⚠️  Skipping metrics test - Worker not available')
        return
      }

      const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/health`)
      const data = await response.json()

      expect(data.worker.running).toBe(true)
      expect(data.worker.paused).toBe(false)
      expect(data.worker.name).toBe('store-documents')
      expect(data.services.redis).toBe('connected')
      expect(data.services.database).toBe('connected')
    }, 10000)

    test('health endpoint should include timestamp', async () => {
      if (!process.env.REDIS_HOST || !workerProcess) {
        console.log('⚠️  Skipping timestamp test - Worker not available')
        return
      }

      const response = await fetch(`http://localhost:${WORKER_HEALTH_PORT}/health`)
      const data = await response.json()

      expect(data.timestamp).toBeDefined()

      const timestamp = new Date(data.timestamp)
      expect(timestamp.toString()).not.toBe('Invalid Date')

      // Timestamp should be recent (within last 5 seconds)
      const now = Date.now()
      const timestampAge = now - timestamp.getTime()
      expect(timestampAge).toBeLessThan(5000)
    }, 10000)
  })

  describe('Worker graceful shutdown', () => {
    test('should handle SIGTERM gracefully', async () => {
      if (!process.env.REDIS_HOST) {
        console.log('⚠️  Skipping shutdown test - Redis not configured')
        return
      }

      // Start a fresh worker for shutdown test
      const shutdownProc = spawn({
        cmd: ['bun', 'src/hocuspocus.worker.ts'],
        env: {
          ...process.env,
          WORKER_HEALTH_PORT: '3004', // Different port
          NODE_ENV: 'test'
        },
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: '/Users/macbook/workspace/docsy/packages/hocuspocus.server'
      })

      // Wait for it to start
      await Bun.sleep(2000)

      // Send SIGTERM
      shutdownProc.kill('SIGTERM')

      // Wait for graceful shutdown
      await Bun.sleep(2000)

      // Should have exited
      expect(shutdownProc.exitCode).not.toBe(null)
      expect(shutdownProc.exitCode).toBe(0) // Clean exit
    }, 15000)
  })
})
