import { DiscordApiError } from '../discord/client.ts'
import { renderCard } from '../discord/renderer.ts'
import type { GitHubApiClient } from '../github/client.ts'
import {
  buildDailyTriageDigest,
  buildPeriodReportCard,
  computeReportWindow
} from '../projection/digest.ts'
import type { SqliteStore } from '../store/sqliteStore.ts'
import type {
  ChannelKey,
  DigestKind,
  DiscordTransport,
  EntityState,
  GitHubIssue,
  IssueBatchItem,
  PushBatchItem,
  QueueJobRecord,
  RelayConfig,
  StarBatchItem
} from '../types.ts'
import { EventBatcher } from './batcher.ts'

const CHANNELS: ChannelKey[] = ['github', 'triage', 'releases']
const MAX_JOB_ATTEMPTS = 5

export class ChannelQueue {
  private readonly config: RelayConfig
  private readonly store: SqliteStore
  private readonly discord: DiscordTransport
  private readonly github: GitHubApiClient
  private readonly batcher: EventBatcher
  private readonly inFlight = new Set<ChannelKey>()
  private readonly inFlightDigests = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(
    config: RelayConfig,
    store: SqliteStore,
    discord: DiscordTransport,
    github: GitHubApiClient
  ) {
    this.config = config
    this.store = store
    this.discord = discord
    this.github = github
    this.batcher = new EventBatcher(config, store, github)
  }

  start(pollIntervalMs = 500): void {
    if (this.timer) return
    this.stopped = false
    this.timer = setInterval(() => {
      void this.tick()
    }, pollIntervalMs)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await this.batcher.waitForIdle()
    while (this.inFlight.size > 0 || this.inFlightDigests.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    await this.batcher.waitForIdle()
  }

  addPushItem(item: PushBatchItem, nowMs = Date.now()): void {
    this.batcher.addPushItem(item, nowMs)
  }

  addIssueOpenItem(item: IssueBatchItem, nowMs = Date.now()): void {
    this.batcher.addIssueOpenItem(item, nowMs)
  }

  addIssueCloseItem(item: IssueBatchItem, nowMs = Date.now()): void {
    this.batcher.addIssueCloseItem(item, nowMs)
  }

  mergePendingIssueOpen(issue: GitHubIssue): boolean {
    return this.batcher.mergePendingIssueOpen(issue)
  }

  addStarItem(item: StarBatchItem, nowMs = Date.now()): void {
    this.batcher.addStarItem(item, nowMs)
  }

  async flushExpiredBatches(nowMs = Date.now()): Promise<void> {
    await this.batcher.flushExpiredBatches(nowMs)
  }

  async tick(nowMs = Date.now()): Promise<void> {
    if (this.stopped) return
    await this.batcher.flushExpiredBatches(nowMs)
    if (this.stopped) return
    await Promise.all(CHANNELS.map((ch) => this.drainChannel(ch, nowMs)))
  }

  async drainAll(nowMs = Date.now()): Promise<void> {
    await this.batcher.flushExpiredBatches(nowMs)
    await Promise.all(CHANNELS.map((ch) => this.drainChannel(ch, nowMs)))
  }

  private async drainChannel(channelKey: ChannelKey, nowMs: number): Promise<void> {
    if (this.inFlight.has(channelKey)) return
    this.inFlight.add(channelKey)
    try {
      while (!this.stopped) {
        const job = this.store.peekNextJob(channelKey)
        if (!job || job.availableAt > nowMs) break
        await this.executeJob(job, nowMs)
      }
    } finally {
      this.inFlight.delete(channelKey)
    }
  }

  private async executeJob(job: QueueJobRecord, nowMs: number): Promise<void> {
    const channelId = this.config.channels[job.channelKey]
    const payload = job.payload

    try {
      if (payload.op === 'post') {
        await this.discord.sendMessage(channelId, renderCard(payload.card))
      } else if (payload.op === 'upsert_entity') {
        const existing = this.store.getEntity(payload.entityKey)
        const discordPayload = renderCard(payload.card)

        let messageId: string
        if (
          !payload.forceNew &&
          existing &&
          existing.anchorMessageId &&
          existing.channelId === channelId
        ) {
          const edited = await this.discord.editMessage(
            channelId,
            existing.anchorMessageId,
            discordPayload
          )
          if ('notFound' in edited) {
            const created = await this.discord.sendMessage(channelId, discordPayload)
            messageId = created.id
          } else {
            messageId = edited.id
          }
        } else {
          const created = await this.discord.sendMessage(channelId, discordPayload)
          messageId = created.id
        }

        const updated = this.store.updateEntityAnchor(
          payload.entityKey,
          job.channelKey,
          channelId,
          messageId,
          Date.now()
        )
        // Preserve live-DB upgrade compatibility for pre-existing queued jobs carrying inline state.
        if (!updated) {
          const legacyState = (payload as { state?: EntityState }).state
          if (legacyState) {
            this.store.upsertEntity({
              entityKey: payload.entityKey,
              entityType: payload.entityType,
              channelKey: job.channelKey,
              channelId,
              anchorMessageId: messageId,
              state: legacyState,
              updatedAt: Date.now()
            })
          }
        }
      } else if (payload.op === 'reply_to_entity') {
        const existing = this.store.getEntity(payload.entityKey)
        const cardWithRef =
          existing && existing.anchorMessageId
            ? { ...payload.card, replyToMessageId: existing.anchorMessageId }
            : payload.card
        await this.discord.sendMessage(channelId, renderCard(cardWithRef))
      }

      this.store.completeJob(job.id)
    } catch (err) {
      if (err instanceof DiscordApiError && !err.retryable) {
        console.error(
          `[queue:${job.channelKey}] Dropping non-retryable job ${job.id} (${job.kind}) after HTTP ${err.status}:`,
          err.message
        )
        this.store.completeJob(job.id)
        return
      }

      const nextAttempts = job.attempts + 1
      if (nextAttempts >= MAX_JOB_ATTEMPTS) {
        console.error(
          `[queue:${job.channelKey}] Dropping job ${job.id} (${job.kind}) after ${nextAttempts} attempts:`,
          err
        )
        this.store.completeJob(job.id)
        return
      }
      const backoffMs = Math.min(60_000, 1000 * Math.pow(2, nextAttempts))
      console.warn(
        `[queue:${job.channelKey}] Job ${job.id} (${job.kind}) failed (attempt ${nextAttempts}); retrying in ${backoffMs}ms`
      )
      this.store.rescheduleJob(job.id, Math.max(Date.now(), nowMs) + backoffMs, nextAttempts)
    }
  }

  async runDigest(kind: DigestKind, opts?: { force?: boolean; now?: Date }): Promise<boolean> {
    const now = opts?.now ?? new Date()

    if (kind === 'daily') {
      const runKey = `daily:${now.toISOString().slice(0, 10)}`
      if (this.inFlightDigests.has(runKey)) return false
      if (!opts?.force && this.store.hasRunKey(runKey)) return false

      this.inFlightDigests.add(runKey)
      try {
        const snapshot = await this.github.fetchDigestSnapshot(this.config.githubRepository)
        const card = buildDailyTriageDigest(snapshot, this.config)

        if (!card) {
          this.store.markRunKey(runKey, now.getTime())
          return false
        }

        this.store.runTransaction(() => {
          this.store.enqueueJob('triage', 'digest.daily', { op: 'post', card })
          this.store.markRunKey(runKey, now.getTime())
        })
        await this.drainChannel('triage', Date.now())
        return true
      } finally {
        this.inFlightDigests.delete(runKey)
      }
    }

    const window = computeReportWindow(kind, now)
    if (this.inFlightDigests.has(window.runKey)) return false
    if (!opts?.force && this.store.hasRunKey(window.runKey)) return false

    this.inFlightDigests.add(window.runKey)
    try {
      const report = await this.github.fetchPeriodReport(
        this.config.githubRepository,
        kind,
        window.sinceMs,
        window.untilMs,
        window.periodLabel
      )
      const card = buildPeriodReportCard(report, this.config)

      if (!card) {
        this.store.markRunKey(window.runKey, now.getTime())
        return false
      }

      this.store.runTransaction(() => {
        this.store.enqueueJob('github', `digest.${kind}`, { op: 'post', card })
        this.store.markRunKey(window.runKey, now.getTime())
      })
      await this.drainChannel('github', Date.now())
      return true
    } finally {
      this.inFlightDigests.delete(window.runKey)
    }
  }
}
