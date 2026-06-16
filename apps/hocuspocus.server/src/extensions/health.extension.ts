import { logger } from '../lib/logger'

const healthLogger = logger.child({ extension: 'health' })

// Health check extension for Hocuspocus
export class HealthCheck {
  server: any
  extensions: any[]
  status: {
    websocket: {
      status: string
      connections: number
      lastCheck: Date
    }
  }

  constructor() {
    this.server = null
    this.extensions = []
    this.status = {
      websocket: {
        status: 'healthy',
        connections: 0,
        lastCheck: new Date()
      }
    }
  }

  onConnect() {
    this.status.websocket.connections += 1
    this.status.websocket.lastCheck = new Date()
  }

  onDisconnect() {
    this.status.websocket.connections -= 1
    this.status.websocket.lastCheck = new Date()
  }

  onConfigure(data: any) {
    if (!data) {
      healthLogger.warn('onConfigure received no data')
      return
    }

    if (!data.instance) {
      healthLogger.warn({ data }, 'onConfigure received data but no instance')
      return
    }

    this.server = data.instance
    this.extensions = data.extensions

    if (!this.server) {
      healthLogger.error('Failed to set server instance after assignment')
    } else {
      healthLogger.debug('Server instance successfully configured')
    }
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date(),
      services: {
        websocket: this.status.websocket,
        database: this.getDatabaseStatus(),
        redis: this.getRedisStatus()
      }
    }
  }

  getDatabaseStatus() {
    if (!this.server) {
      healthLogger.warn('Server instance is null in getDatabaseStatus')
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: 'Server instance is null'
      }
    }

    if (!this.extensions) {
      healthLogger.warn('Server instance has no extensions')
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: 'Server extensions not found'
      }
    }

    const dbExtension = this.extensions.find((ext) => ext.constructor.name === 'Database')
    if (!dbExtension) {
      return { status: 'unhealthy', lastCheck: new Date(), error: 'Database extension not found' }
    }

    // Presence-based: this extension only sees the Database extension object, not a
    // live connection, so report 'configured' (wired — NOT a liveness claim, which
    // would mask a DB outage). Real DB liveness is the worker + REST /health probes.
    return {
      status: 'configured',
      lastCheck: new Date()
    }
  }

  getRedisStatus() {
    if (!this.extensions) {
      return {
        status: 'unhealthy',
        error: 'Server not initialized'
      }
    }

    const redisExtension = this.extensions.find((ext) => ext.constructor.name === 'Redis')

    if (!redisExtension) {
      return { status: 'disabled' }
    }

    // Presence-based: the @hocuspocus/extension-redis instance exposes no reliable
    // sync connection flag, so report 'configured' (present — NOT a liveness claim,
    // which would mask an outage). Real liveness is the worker /health probe.
    return {
      status: 'configured',
      lastCheck: new Date()
    }
  }
}
