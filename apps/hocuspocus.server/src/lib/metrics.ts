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
  help: 'Inbound collaboration messages by protocol type',
  labelNames: ['type'] as const,
  registers: [register]
})

// awareness churn fires on inbound updates AND local/disconnect removals, so this
// over-counts pure inbound traffic — fine for an aggregate cursor-activity signal.
export const wsAwarenessUpdatesTotal = new Counter({
  name: 'ws_awareness_updates_total',
  help: 'Total awareness (presence/cursor) update events',
  registers: [register]
})

// Live count of documents held in memory, read from the Hocuspocus instance at
// scrape time via collect() — drift-proof vs inc/dec on load/unload hooks.
let activeDocumentsProvider: (() => number) | null = null
export const setActiveDocumentsProvider = (fn: () => number): void => {
  activeDocumentsProvider = fn
}

export const wsActiveDocuments = new Gauge({
  name: 'ws_active_documents',
  help: 'Documents currently loaded in server memory',
  registers: [register],
  collect() {
    if (activeDocumentsProvider) this.set(activeDocumentsProvider())
  }
})

// Full document load bracket (onLoadDocument → afterLoadDocument), includes the
// Database fetch (Postgres read) regardless of extension order.
export const documentLoadDuration = new Histogram({
  name: 'document_load_duration_seconds',
  help: 'Document load time in seconds (fetch + decode)',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
})

// Hocuspocus store-hook OVERHEAD (Y.Doc decode + base64 encode + BullMQ enqueue),
// NOT DB write latency — the real Postgres write runs async in the worker and is
// measured by job_duration_seconds{queue=store-document}. Only the queue-down
// fallback path includes a direct write.
export const documentPersistDuration = new Histogram({
  name: 'document_persist_duration_seconds',
  help: 'Hocuspocus store-hook duration in seconds (enqueue overhead, not DB write)',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
})

// Size of each merged Y.Doc update applied to a document, a proxy for edit volume.
export const ydocUpdateBytes = new Histogram({
  name: 'ydoc_update_bytes',
  help: 'Size in bytes of each applied Y.Doc update',
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
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
