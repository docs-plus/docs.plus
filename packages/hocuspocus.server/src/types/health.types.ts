// Health check status
export type HealthStatus = 'healthy' | 'unhealthy' | 'disabled'

// Individual health check result
export interface HealthCheckResult {
  status: HealthStatus
  lastCheck: Date
  error?: string
}

// Overall health result
export interface OverallHealthResult {
  status: 'ok' | 'degraded'
  timestamp: Date
  services: {
    database: HealthCheckResult
    redis: HealthCheckResult
    supabase: HealthCheckResult
  }
}

// Service health interface
export interface ServiceHealth {
  database: HealthCheckResult
  redis: HealthCheckResult
  supabase: HealthCheckResult
}
