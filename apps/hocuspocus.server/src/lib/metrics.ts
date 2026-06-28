import type { MiddlewareHandler } from 'hono'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'

// One shared registry for every service; runtime defaults (heap, RSS, CPU,
// event-loop lag, GC where Bun exposes them) attach here once at import time.
export const register = new Registry()
collectDefaultMetrics({ register })

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
})

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register]
})

export const wsActiveConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Currently open WebSocket connections',
  registers: [register]
})

export const wsConnectionsTotal = new Counter({
  name: 'ws_connections_total',
  help: 'Total WebSocket connections opened',
  registers: [register]
})

export const wsAuthRejectionsTotal = new Counter({
  name: 'ws_auth_rejections_total',
  help: 'Total WebSocket authentication rejections',
  registers: [register]
})

export const wsMessagesTotal = new Counter({
  name: 'ws_messages_total',
  help: 'Total WebSocket messages received',
  registers: [register]
})

export const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Background job processing time in seconds',
  labelNames: ['queue', 'status'] as const,
  registers: [register]
})

export const jobsTotal = new Counter({
  name: 'jobs_total',
  help: 'Total background jobs processed',
  labelNames: ['queue', 'status'] as const,
  registers: [register]
})

export const queueJobs = new Gauge({
  name: 'queue_jobs',
  help: 'Jobs per queue by state (depth)',
  labelNames: ['queue', 'state'] as const,
  registers: [register]
})

export const metricsContentType = register.contentType

export const metricsText = (): Promise<string> => register.metrics()

// Times each request and records duration + count, labelled by the matched route
// pattern (never the raw path) to keep label cardinality bounded.
export const httpMetricsMiddleware = (): MiddlewareHandler => async (c, next) => {
  const stop = httpRequestDuration.startTimer()
  try {
    await next()
  } finally {
    const route = c.req.routePath ?? 'unmatched'
    const labels = { method: c.req.method, route, status: String(c.res.status) }
    stop(labels)
    httpRequestsTotal.inc(labels)
  }
}
