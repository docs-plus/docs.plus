import type { MiddlewareHandler } from 'hono'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'

import pkg from '../../package.json'

// One shared registry for every service; runtime defaults (heap, RSS, CPU,
// event-loop lag, GC where Bun exposes them) attach here once at import time.
export const register = new Registry()
collectDefaultMetrics({ register })

// Constant 1; version prefers the deploy-injected GIT_HASH, service mirrors the
// SENTRY_ROLE split used by instrument.ts.
export const buildInfo = new Gauge({
  name: 'docsplus_build_info',
  help: 'Build metadata for the running service (always 1)',
  labelNames: ['version', 'service'] as const,
  registers: [register]
})
buildInfo.set(
  {
    version: process.env.GIT_HASH || pkg.version,
    service: process.env.SENTRY_ROLE || 'hocuspocus'
  },
  1
)

// The ladder runs to 60 because the REST server sets `idleTimeout: 60`. Stopping
// at 5 put every request between 5 s and that ceiling in one overflow bucket.
// histogram_quantile could then never report a p95 above 5 s.
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register]
})

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register]
})

// Live count derived at scrape time, not inc/dec: onConnect fires pre-auth but
// onDisconnect only fires for sockets that finished auth. A rejection storm would
// therefore drift an inc/dec gauge upward forever.
let activeConnectionsProvider: (() => number) | null = null
export const setActiveConnectionsProvider = (fn: () => number): void => {
  activeConnectionsProvider = fn
}

export const wsActiveConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Currently open WebSocket connections',
  registers: [register],
  collect() {
    if (activeConnectionsProvider) this.set(activeConnectionsProvider())
  }
})

export const wsConnectionsTotal = new Counter({
  name: 'ws_connections_total',
  help: 'Total WebSocket connections opened',
  registers: [register]
})

// Labelled so the fail-closed deny is visible too. A metadata lookup that throws
// (wedged pool, Postgres outage) denies every handshake. Without a counter on
// that arm the rejection ratio the alert reads FALLS while the outage runs.
export const wsAuthRejectionsTotal = new Counter({
  name: 'ws_auth_rejections_total',
  help: 'Total WebSocket authentication rejections',
  labelNames: ['reason'] as const,
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
// NOT DB write latency. The real Postgres write runs async in the worker and is
// measured by job_duration_seconds{queue=store-documents}. Only the queue-down
// fallback path includes a direct write.
export const documentPersistDuration = new Histogram({
  name: 'document_persist_duration_seconds',
  help: 'Hocuspocus store-hook duration in seconds (enqueue overhead, not DB write)',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
})

// Each fallback is a synchronous Postgres write on the WS event loop (queue
// down/OOM) — sustained increments mean Redis needs attention, not the DB.
export const documentPersistFallbackTotal = new Counter({
  name: 'document_persist_fallback_total',
  help: 'Document saves that bypassed the queue and wrote directly to Postgres',
  registers: [register]
})

// A rejection out of the store hook poisons Hocuspocus's debouncer for the process
// lifetime. That room then never saves and never unloads. The hook therefore gives up
// instead. This counter is the only remaining trace that it happened.
export const documentStoreRejectionsTotal = new Counter({
  name: 'document_store_rejections_total',
  help: 'Document saves the store hook abandoned rather than rethrow, by reason',
  labelNames: ['reason'] as const,
  registers: [register]
})

// A DOCX export that loses every image still returns 200 with a readable file,
// so a misconfigured media origin is invisible without this. Alert on a drop
// rate near 1, not on any drop: refusing hostile bytes is the feature working.
export const documentExportImagesDroppedTotal = new Counter({
  name: 'document_export_images_dropped_total',
  help: 'Images removed from a document export rather than embedded, by reason',
  labelNames: ['reason'] as const,
  registers: [register]
})

// Stateless relays refused before broadcast. `oversized` is an anonymous client
// probing the amplifier that OOM-killed replicas before the budget existed.
// `type-not-allowed` and `broadcast-frame` are someone trying to mint the access
// events the webapp obeys. Different alarms, so the reason has to be countable.
export const statelessRelayDroppedTotal = new Counter({
  name: 'stateless_relay_dropped_total',
  help: 'Stateless relay payloads refused before broadcast, by reason',
  labelNames: ['reason'] as const,
  registers: [register]
})

// Content API applies, by mode and outcome. `error` covers a wedged store, which
// keeps mutating and broadcasting to live clients while never persisting — the
// operator signal API.md tells callers to watch. Never label by documentId.
export const documentContentApplyTotal = new Counter({
  name: 'document_content_apply_total',
  help: 'Document Content API applies by mode and outcome',
  labelNames: ['mode', 'outcome'] as const,
  registers: [register]
})

// One read decides who a content change is allowed to mute. Every degraded arm
// returns no ids, so `timeout`, `error` and `no-client` look exactly like the
// `empty` room they are counted apart from. Read them together or the feature
// can stop muting anyone and still look healthy.
export const documentOccupancyReadsTotal = new Counter({
  name: 'document_occupancy_reads_total',
  help: 'Occupancy reads taken before a content-change fan-out, by outcome',
  labelNames: ['outcome'] as const,
  registers: [register]
})

// A lost register or refresh mutes nobody, which is the safe direction. A lost
// release leaves a dead socket present until the 45 s stale bound prunes it, and
// it can also stamp Last left while another tab of that person is still open.
export const documentOccupancyWritesTotal = new Counter({
  name: 'document_occupancy_writes_total',
  help: 'Occupancy set writes by operation and outcome',
  labelNames: ['op', 'outcome'] as const,
  registers: [register]
})

// Last left is the window the digest and the History compare both read. `no-row`
// is ordinary for a visitor with no membership row, and `skipped-present` is the
// two-tab rule working. A rising `error` is neither.
export const documentLastLeftStampsTotal = new Counter({
  name: 'document_last_left_stamps_total',
  help: 'Last left stamp attempts made when a document session closed, by outcome',
  labelNames: ['outcome'] as const,
  registers: [register]
})

// Rate limiter fail-opens, by reason. Before the timeout arm a slow Redis held
// requests for 60s, which tripped the p95 latency alert. It now answers in well
// under a second, so that alert stays quiet and no rule matches a level-40 warn.
// This counter is the only remaining trace.
export const rateLimitFailOpenTotal = new Counter({
  name: 'rate_limit_fail_open_total',
  help: 'Requests allowed through because the rate limiter could not decide, by reason',
  labelNames: ['reason', 'bucket'] as const,
  registers: [register]
})

// Retention sweep arms. `skipped` is the healthy steady state at two replicas,
// so it cannot be read alone: a stuck lease key also produces only `skipped`.
// Alert on the absence of `ran` across the fleet, never on `skipped` rising.
export const retentionLeaseTotal = new Counter({
  name: 'retention_lease_total',
  help: 'Retention sweep attempts by lease outcome',
  labelNames: ['outcome'] as const,
  registers: [register]
})

// The degraded arms matter most here. This is the only rate limit on the revert
// path, and a Redis fault silently drops it back to one budget per process.
export const revertCooldownTotal = new Counter({
  name: 'revert_cooldown_total',
  help: 'history.revert cooldown decisions, by outcome',
  labelNames: ['outcome'] as const,
  registers: [register]
})

// The gauge that reads this cache lives in lib/auth.ts, beside the Map it
// measures. Registered here it published 0 from the worker, which never imports
// auth.ts, and a constant 0 dilutes any average across scrape jobs.
export const authTokenCacheLookupsTotal = new Counter({
  name: 'auth_token_cache_lookups_total',
  help: 'Supabase token verifications served from cache or sent to Auth, by result',
  labelNames: ['result'] as const,
  registers: [register]
})

// Size of each merged Y.Doc update applied to a document, a proxy for edit volume.
export const ydocUpdateBytes = new Histogram({
  name: 'ydoc_update_bytes',
  help: 'Size in bytes of each applied Y.Doc update',
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
  registers: [register]
})

// The whole stored state, not one update, so the ladder runs well past
// ydoc_update_bytes. Largest measured row is 244,903 B. The top bucket is 64 MiB
// because a loaded room costs 16.5-17x its snapshot in heap, which already
// exceeds the 1024 M WS replica ceiling.
export const documentSnapshotBytes = new Histogram({
  name: 'document_snapshot_bytes',
  help: 'Size in bytes of each stored document snapshot',
  buckets: [256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864],
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

// BullMQ stamps processedOn/finishedOn in ms; absent only on malformed jobs.
export function recordJobOutcome(
  queue: string,
  status: 'completed' | 'failed' | 'stalled',
  job?: { processedOn?: number; finishedOn?: number }
) {
  jobsTotal.inc({ queue, status })
  if (job?.processedOn && job?.finishedOn) {
    jobDuration.observe({ queue, status }, (job.finishedOn - job.processedOn) / 1000)
  }
}

export const queueJobs = new Gauge({
  name: 'queue_jobs',
  help: 'Jobs per queue by state (depth)',
  labelNames: ['queue', 'state'] as const,
  registers: [register]
})

export const pgmqMessagesTotal = new Counter({
  name: 'pgmq_messages_total',
  help: 'Total pgmq messages handled by the consumers',
  labelNames: ['queue', 'status'] as const,
  registers: [register]
})

// Seeded at consumer start and refreshed only by successful reads, so a wedged
// consumer shows as a stale series instead of an absent one.
export const pgmqLastSuccessfulPoll = new Gauge({
  name: 'pgmq_last_successful_poll_timestamp_seconds',
  help: 'Unix time of the last successful pgmq queue read',
  labelNames: ['queue'] as const,
  registers: [register]
})

export const pgmqQueueLength = new Gauge({
  name: 'pgmq_queue_length',
  help: 'Messages currently sitting in each pgmq queue',
  labelNames: ['queue'] as const,
  registers: [register]
})

export const pgmqOldestMessageAge = new Gauge({
  name: 'pgmq_oldest_message_age_seconds',
  help: 'Age of the oldest message in each pgmq queue',
  labelNames: ['queue'] as const,
  registers: [register]
})

export const cronJobLastSuccess = new Gauge({
  name: 'cron_job_last_success_timestamp_seconds',
  help: 'Unix time of the last successful pg_cron job run',
  labelNames: ['jobname'] as const,
  registers: [register]
})

export const mediaWorkspaceMaxUsagePercent = new Gauge({
  name: 'media_workspace_max_usage_percent',
  help: 'Highest media storage quota usage across all workspaces',
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
