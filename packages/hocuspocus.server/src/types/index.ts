// Global type definitions and interfaces

export interface AppContext {
  prisma: any
  redis: any
}

export interface DocumentMetadata {
  id: number
  slug: string
  title: string | null
  description: string | null
  keywords: string | null
  isPrivate: boolean
  readOnly: boolean
  ownerId: string | null
  email: string | null
  documentId: string
  createdAt: Date
  updatedAt: Date
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'disabled'
  lastCheck: Date
  error?: string
}

export interface ServiceHealth {
  database: HealthStatus
  redis: HealthStatus
  supabase: HealthStatus
}

export interface OverallHealth {
  status: 'ok' | 'degraded'
  timestamp: Date
  services: ServiceHealth
}
