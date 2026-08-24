export type HealthStatus = 'healthy' | 'unhealthy' | 'disabled'

export interface HealthCheckResult {
  status: HealthStatus
  lastCheck: Date
  error?: string
  metadata?: any
}

export interface OverallHealthResult {
  status: 'ok' | 'degraded'
  timestamp: Date
  services: {
    database: HealthCheckResult
    redis: HealthCheckResult
    supabase: HealthCheckResult
  }
}

export interface ServiceHealth {
  database: HealthCheckResult
  redis: HealthCheckResult
  supabase: HealthCheckResult
}
