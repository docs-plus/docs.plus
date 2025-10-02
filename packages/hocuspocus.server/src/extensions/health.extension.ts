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
      console.warn('HealthCheck: onConfigure received no data')
      return
    }

    if (!data.instance) {
      console.warn('HealthCheck: onConfigure received data but no instance:', data)
      return
    }

    this.server = data.instance
    this.extensions = data.extensions

    if (!this.server) {
      console.error('HealthCheck: Failed to set server instance after assignment')
    } else {
      console.debug('HealthCheck: Server instance successfully configured')
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
      console.warn('HealthCheck: Server instance is null in getDatabaseStatus')
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: 'Server instance is null'
      }
    }

    if (!this.extensions) {
      console.warn('HealthCheck: Server instance has no extensions')
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: 'Server extensions not found'
      }
    }

    const dbExtension = this.extensions.find((ext) => ext.constructor.name === 'Database')
    return {
      status: dbExtension ? 'healthy' : 'unhealthy',
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

    return {
      status: (redisExtension as any).connected ? 'healthy' : 'unhealthy',
      lastCheck: new Date()
    }
  }
}
