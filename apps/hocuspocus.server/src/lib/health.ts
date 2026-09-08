import type { Hocuspocus } from '@hocuspocus/server'

// 'configured' means wired, never reachable. A liveness claim here would mask a
// real outage behind a 200, and the worker plus REST /health probes own liveness.
export type SubjectHealth = { status: 'configured'; lastCheck: Date } | { status: 'disabled' }

export type WebsocketHealth = {
  status: 'healthy'
  connections: number
  lastCheck: Date
}

export type HealthReport = {
  status: 'ok'
  timestamp: Date
  services: {
    websocket: WebsocketHealth
    database: SubjectHealth
    redis: SubjectHealth
  }
}

// Auth-rejected sockets never attach to a document, so a per-document sum counts
// only real ones. Read at call time: an inc/dec pair drifted both ways. The sum
// double-counts one socket in two rooms, and two Grafana alerts gate on it.
export const countActiveConnections = (hocuspocus: Hocuspocus): number =>
  [...hocuspocus.documents.values()].reduce((sum, doc) => sum + doc.getConnectionsCount(), 0)

// Redis sync is the one optional subject, so the caller states this boolean where
// it pushes that extension. The readiness route reads it without a report, so the
// room walk stays out of the probe the container healthcheck calls.
export const redisSyncHealth = (redisWired: boolean): SubjectHealth =>
  redisWired ? { status: 'configured', lastCheck: new Date() } : { status: 'disabled' }

// One report answers every health route, and each route returns a slice of it.
// Every route answers 200 whatever it reports, so the rolling deploy gates on the
// status code of /health/ready and never on these words.
export const buildHealthReport = (hocuspocus: Hocuspocus, redisWired: boolean): HealthReport => ({
  status: 'ok',
  timestamp: new Date(),
  services: {
    websocket: {
      status: 'healthy',
      connections: countActiveConnections(hocuspocus),
      lastCheck: new Date()
    },
    // The Database extension is pushed unconditionally, so this subject has no
    // absent arm to report.
    database: { status: 'configured', lastCheck: new Date() },
    redis: redisSyncHealth(redisWired)
  }
})

// Each route returns a slice of one report, so /health and its three sub-routes
// cannot drift apart. /health/ready is not a slice: it gates on Postgres and
// carries its own body, so it stays with the request handler.
export const healthRoutes: Record<string, (report: HealthReport) => unknown> = {
  '/health': (report) => report,
  '/health/websocket': (report) => report.services.websocket,
  '/health/database': (report) => report.services.database,
  '/health/redis': (report) => report.services.redis
}
