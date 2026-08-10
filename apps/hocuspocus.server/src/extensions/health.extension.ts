import { logger } from '../lib/logger'

const healthLogger = logger.child({ extension: 'health' })

// Health check extension for Hocuspocus
export class HealthCheck {
  server: any
  extensions: any[]

  constructor() {
    this.server = null
    this.extensions = []
  }

  // Counted at read time, like the /metrics providers. An inc/dec pair drifted
  // both ways. onConnect runs before onAuthenticate, so a rejected token adds a
  // connection that never disconnects. A direct connection's unload fires
  // onDisconnect with no matching onConnect, which could take the count negative.
  getWebsocketStatus() {
    const documents = this.server?.documents
    const connections = documents
      ? [...documents.values()].reduce(
          (sum: number, doc: any) => sum + doc.getConnectionsCount(),
          0
        )
      : 0

    return {
      status: 'healthy',
      connections,
      lastCheck: new Date()
    }
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
        websocket: this.getWebsocketStatus(),
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

    // Presence-based: this extension only sees the Database extension object, not
    // a live connection. Report 'configured', meaning wired — NOT a liveness claim,
    // which would mask a DB outage. Real DB liveness is the worker + REST /health
    // probes.
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
