import { fetchFleetRows } from '../api/services/adminMediaStorage.service'
import { EmailDeadLetterQueue, EmailQueue } from './email/queue'
import { workerLogger } from './logger'
import {
  cronJobLastSuccess,
  mediaWorkspaceMaxUsagePercent,
  pgmqOldestMessageAge,
  pgmqQueueLength,
  queueJobs
} from './metrics'
import { pushDeadLetterQueue, pushQueue } from './push/queue'
import { DeadLetterQueue, StoreDocumentQueue } from './queue'
import { getServiceRoleClient } from './supabase'

const QUEUE_METRICS_INTERVAL_MS = 15000

// DLQs included: their `waiting` depth is the alerting signal for poisoned jobs.
const monitoredQueues = [
  StoreDocumentQueue,
  DeadLetterQueue,
  EmailQueue,
  EmailDeadLetterQueue,
  pushQueue,
  pushDeadLetterQueue
].filter((queue) => queue !== null)

async function sampleQueueDepth() {
  for (const queue of monitoredQueues) {
    try {
      const counts = await queue.getJobCounts()
      for (const [state, count] of Object.entries(counts)) {
        queueJobs.set({ queue: queue.name, state }, count)
      }
    } catch (err) {
      workerLogger.warn({ err, queue: queue.name }, 'Failed to sample queue depth metrics')
    }
  }
}

// Warn once per failure streak (these RPCs may not exist right after a deploy),
// re-arming on the next success so a later outage still logs.
const supabaseSampleFailing = new Set<string>()
function warnSupabaseSampleFailure(source: string, err: unknown) {
  if (supabaseSampleFailing.has(source)) return
  supabaseSampleFailing.add(source)
  workerLogger.warn({ err, source }, 'Supabase metrics sampling failed - skipping')
}
function markSupabaseSampleSuccess(source: string) {
  supabaseSampleFailing.delete(source)
}

interface PgmqQueueMetricsRow {
  queue_name: string
  queue_length: number
  oldest_msg_age_sec: number | null
  total_messages: number
}

async function samplePgmqQueueMetrics() {
  const client = getServiceRoleClient()
  if (!client) return
  const fail = (err: unknown) => {
    // Drop the series instead of freezing last-good values; alerts see NoData.
    pgmqQueueLength.reset()
    pgmqOldestMessageAge.reset()
    warnSupabaseSampleFailure('get_pgmq_queue_metrics', err)
  }
  try {
    const { data, error } = await client.rpc('get_pgmq_queue_metrics')
    if (error) return fail(error)
    for (const row of (data ?? []) as PgmqQueueMetricsRow[]) {
      pgmqQueueLength.set({ queue: row.queue_name }, Number(row.queue_length))
      pgmqOldestMessageAge.set({ queue: row.queue_name }, Number(row.oldest_msg_age_sec ?? 0))
    }
    markSupabaseSampleSuccess('get_pgmq_queue_metrics')
  } catch (err) {
    fail(err)
  }
}

interface CronJobHealthRow {
  jobname: string
  last_run_status: string | null
  last_success_at: string | null
}

async function sampleCronJobHealth() {
  const client = getServiceRoleClient()
  if (!client) return
  const fail = (err: unknown) => {
    // Absent series trips the NoData alerting on the cron-stale rules (dead-man).
    cronJobLastSuccess.reset()
    warnSupabaseSampleFailure('get_cron_job_health', err)
  }
  try {
    const { data, error } = await client.rpc('get_cron_job_health')
    if (error) return fail(error)
    for (const row of (data ?? []) as CronJobHealthRow[]) {
      // Never-succeeded jobs emit 0 so time()-based staleness alerts page immediately.
      const lastSuccess = row.last_success_at ? new Date(row.last_success_at).getTime() / 1000 : 0
      cronJobLastSuccess.set({ jobname: row.jobname }, lastSuccess)
    }
    markSupabaseSampleSuccess('get_cron_job_health')
  } catch (err) {
    fail(err)
  }
}

async function sampleMediaUsage() {
  const client = getServiceRoleClient()
  if (!client) return
  const fail = (err: unknown) => {
    mediaWorkspaceMaxUsagePercent.reset()
    warnSupabaseSampleFailure('media_storage_stats', err)
  }
  try {
    const result = await fetchFleetRows(client)
    if (result.status !== 'ok') return fail(new Error(result.message))
    mediaWorkspaceMaxUsagePercent.set(Math.max(0, ...result.data.map((row) => row.usage_percent)))
    markSupabaseSampleSuccess('media_storage_stats')
  } catch (err) {
    fail(err)
  }
}

// Fleet-wide media stats scan every workspace, so sample them on a slower cadence.
const MEDIA_USAGE_SAMPLE_EVERY_TICKS = 20
let metricsTick = 0

function sampleWorkerMetrics() {
  void sampleQueueDepth()
  void samplePgmqQueueMetrics()
  void sampleCronJobHealth()
  if (metricsTick % MEDIA_USAGE_SAMPLE_EVERY_TICKS === 0) void sampleMediaUsage()
  metricsTick++
}

// Sample queue depth on a fixed cadence so /metrics reflects backlog without per-job polling.
export function startWorkerMetricsSampling(): () => void {
  const interval = setInterval(sampleWorkerMetrics, QUEUE_METRICS_INTERVAL_MS)
  sampleWorkerMetrics()
  return () => clearInterval(interval)
}
