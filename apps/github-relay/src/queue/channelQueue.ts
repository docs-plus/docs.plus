import { renderCard } from '../discord/renderer.ts'
import type { GitHubApiClient } from '../github/client.ts'
import { buildDailyTriageDigest, buildWeeklyPulse } from '../projection/digest.ts'
import { hasCriticalLabel } from '../projection/helpers.ts'
import { buildIssueCard, buildTriageBatchCard, isSpecialIssue } from '../projection/issue.ts'
import { buildPushCard } from '../projection/push.ts'
import { buildStarCard, isStarMilestone } from '../projection/star.ts'
import { cleanText } from '../security.ts'
import type { SqliteStore } from '../store/sqliteStore.ts'
import type {
  ChannelKey,
  DiscordTransport,
  GitHubIssue,
  IssueBatchItem,
  IssueEntityState,
  PendingBatchRecord,
  PushBatchItem,
  QueueJobRecord,
  RelayConfig,
  StarBatchItem
} from '../types.ts'

const CHANNELS: ChannelKey[] = ['github', 'triage', 'releases']
const STAR_COOLDOWN_MS = 24 * 3600_000
const MAX_JOB_ATTEMPTS = 5

export class ChannelQueue {
  private readonly config: RelayConfig
  private readonly store: SqliteStore
  private readonly discord: DiscordTransport
  private readonly github: GitHubApiClient
  private readonly inFlight = new Set<ChannelKey>()
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
    while (this.inFlight.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  addPushItem(item: PushBatchItem, nowMs = Date.now()): void {
    const batchKey = `push:${item.repo}:${item.ref}`
    const existing = this.store.getBatch<PushBatchItem>(batchKey)
    const items = existing ? [...existing.items, item] : [item]
    this.store.upsertBatch({
      batchKey,
      channelKey: 'github',
      kind: 'push',
      items,
      flushAt: existing ? existing.flushAt : nowMs + this.config.pushCoalesceMs,
      updatedAt: nowMs
    })
  }

  addIssueOpenItem(item: IssueBatchItem, nowMs = Date.now()): void {
    const batchKey = `issue_open:${item.repo}:${item.actor}`
    const existing = this.store.getBatch<IssueBatchItem>(batchKey)
    const items = existing ? [...existing.items, item] : [item]
    const delay =
      items.length >= 2 ? this.config.triageBurstWindowMs : this.config.issueOpenCoalesceMs
    this.store.upsertBatch({
      batchKey,
      channelKey: 'github',
      kind: 'issue_open',
      items,
      flushAt: nowMs + delay,
      updatedAt: nowMs
    })
  }

  addIssueCloseItem(item: IssueBatchItem, nowMs = Date.now()): void {
    const batchKey = `issue_close:${item.repo}:${item.actor}`
    const existing = this.store.getBatch<IssueBatchItem>(batchKey)
    const items = existing ? [...existing.items, item] : [item]
    const delay = items.length >= 2 ? 6000 : 3000
    this.store.upsertBatch({
      batchKey,
      channelKey: 'github',
      kind: 'issue_close',
      items,
      flushAt: existing ? existing.flushAt : nowMs + delay,
      updatedAt: nowMs
    })
  }

  mergePendingIssueOpen(issue: GitHubIssue): boolean {
    const batches = this.store.findBatchesByKind('issue_open') as Array<
      PendingBatchRecord<IssueBatchItem>
    >
    for (const batch of batches) {
      const idx = batch.items.findIndex((i) => i.number === issue.number)
      if (idx === -1) continue
      const updated = [...batch.items]
      updated[idx] = {
        ...updated[idx],
        title: cleanText(issue.title),
        labels: (issue.labels ?? []).map((l) => l.name),
        assignees: (issue.assignees ?? []).map((a) => cleanText(a.login))
      }
      this.store.upsertBatch({
        ...batch,
        items: updated,
        updatedAt: Date.now()
      })
      return true
    }
    return false
  }

  addStarItem(item: StarBatchItem, nowMs = Date.now()): void {
    if (
      !isStarMilestone(item.stargazersCount) &&
      this.store.isStarOnCooldown(item.login, STAR_COOLDOWN_MS, nowMs)
    ) {
      return
    }
    this.store.markStarNotified(item.login, nowMs)

    const batchKey = `star:${item.repo}`
    const existing = this.store.getBatch<StarBatchItem>(batchKey)
    const items = existing ? [...existing.items, item] : [item]
    this.store.upsertBatch({
      batchKey,
      channelKey: 'github',
      kind: 'star',
      items,
      flushAt: existing ? existing.flushAt : nowMs + this.config.starBurstWindowMs,
      updatedAt: nowMs
    })
  }

  async flushExpiredBatches(nowMs = Date.now()): Promise<void> {
    const expired = this.store.takeExpiredBatches(nowMs)
    if (expired.length === 0) return

    // Process push batches before issue_close so correlated closures fold into push cards.
    expired.sort((a, b) => (a.kind === 'push' ? -1 : b.kind === 'push' ? 1 : 0))

    const absorbedCloseNumbers = new Set<number>()
    for (const batch of expired) {
      if (batch.kind === 'push') {
        const pushItems = (batch as PendingBatchRecord<PushBatchItem>).items
        const expiredCloseItems = expired
          .filter((b) => b.kind === 'issue_close')
          .flatMap((b) => (b as PendingBatchRecord<IssueBatchItem>).items)
        const correlated = await this.flushPushBatch(pushItems, expiredCloseItems, nowMs)
        for (const num of correlated) absorbedCloseNumbers.add(num)
      } else if (batch.kind === 'issue_open') {
        this.flushIssueOpenBatch(batch as PendingBatchRecord<IssueBatchItem>, nowMs)
      } else if (batch.kind === 'issue_close') {
        const closeBatch = batch as PendingBatchRecord<IssueBatchItem>
        const remaining = closeBatch.items.filter((i) => !absorbedCloseNumbers.has(i.number))
        const absorbed = closeBatch.items.filter((i) => absorbedCloseNumbers.has(i.number))
        this.updateAnchoredClosures(absorbed, nowMs)
        if (remaining.length > 0) {
          this.flushIssueCloseBatch({ ...closeBatch, items: remaining }, nowMs)
        }
      } else if (batch.kind === 'star') {
        this.flushStarBatch(batch as PendingBatchRecord<StarBatchItem>, nowMs)
      }
    }
  }

  private updateAnchoredClosures(items: IssueBatchItem[], nowMs: number): void {
    for (const item of items) {
      const entity = this.store.getEntity(`issue:${item.number}`)
      if (!entity || entity.state.kind !== 'issue') continue
      const state: IssueEntityState = {
        ...entity.state,
        state: 'closed',
        stateReason: item.stateReason || entity.state.stateReason,
        linkedPrNumber: item.closedByPr ?? entity.state.linkedPrNumber,
        timeline: [...entity.state.timeline, 'Closed']
      }
      const card = buildIssueCard(state, item.repo, true, this.config)
      this.store.enqueueJob(
        'github',
        'issue.closed_anchor',
        {
          op: 'upsert_entity',
          entityKey: `issue:${item.number}`,
          entityType: 'issue',
          card,
          state,
          timeline: state.timeline
        },
        { entityKey: `issue:${item.number}`, nowMs }
      )
    }
  }

  private async flushPushBatch(
    items: PushBatchItem[],
    expiredCloses: IssueBatchItem[],
    nowMs: number
  ): Promise<number[]> {
    if (items.length === 0) return []

    // Suppress duplicate push card when a merged PR already announced the commit.
    const lastAfter = items[items.length - 1].after
    if (this.store.findRecentMerge(lastAfter, 3600_000, nowMs) !== null) {
      const hasExtraUnmergedCommits = items.some((p) => p.commits.length > 1)
      if (!hasExtraUnmergedCommits) return []
    }

    // Fetch full commit range when webhook payload caps at 20 commits.
    for (const item of items) {
      if (item.commits.length >= 20 && item.before && !/^0+$/.test(item.before)) {
        const full = await this.github.compareCommits(item.repo, item.before, item.after)
        if (full && full.length > 0) {
          item.commits = full
        }
      }
    }

    const pushers = new Set(items.map((p) => p.pusher))
    const explicitClosed = new Set(items.flatMap((p) => p.closedIssues))
    const correlatedNumbers: number[] = []

    // Absorb matching pending issue_close batches still waiting in SQLite.
    const pendingCloseBatches = this.store.findBatchesByKind('issue_close') as Array<
      PendingBatchRecord<IssueBatchItem>
    >
    for (const batch of pendingCloseBatches) {
      const keep: IssueBatchItem[] = []
      const absorb: IssueBatchItem[] = []
      for (const closeItem of batch.items) {
        if (
          closeItem.repo === items[0].repo &&
          (explicitClosed.has(closeItem.number) || pushers.has(closeItem.actor))
        ) {
          absorb.push(closeItem)
          correlatedNumbers.push(closeItem.number)
        } else {
          keep.push(closeItem)
        }
      }
      if (absorb.length > 0) {
        this.updateAnchoredClosures(absorb, nowMs)
        if (keep.length === 0) this.store.deleteBatch(batch.batchKey)
        else this.store.upsertBatch({ ...batch, items: keep, updatedAt: nowMs })
      }
    }

    for (const closeItem of expiredCloses) {
      if (
        closeItem.repo === items[0].repo &&
        (explicitClosed.has(closeItem.number) || pushers.has(closeItem.actor))
      ) {
        correlatedNumbers.push(closeItem.number)
      }
    }

    if (correlatedNumbers.length > 0) {
      items[0].closedIssues = Array.from(new Set([...items[0].closedIssues, ...correlatedNumbers]))
    }

    const card = buildPushCard(items)
    if (!card) return correlatedNumbers
    this.store.enqueueJob('github', 'push.batch', { op: 'post', card }, { nowMs })
    return correlatedNumbers
  }

  private flushIssueOpenBatch(batch: PendingBatchRecord<IssueBatchItem>, nowMs: number): void {
    const items = batch.items
    if (items.length === 0) return

    const special: IssueBatchItem[] = []
    const routine: IssueBatchItem[] = []

    for (const item of items) {
      if (isSpecialIssue(item.labels, item.outsider)) {
        special.push(item)
      } else {
        routine.push(item)
      }
    }

    for (const item of special) {
      this.enqueueSingleIssueOpen(item, nowMs)
    }

    if (routine.length >= 3) {
      const card = buildTriageBatchCard(routine, routine[0].repo)
      if (card) {
        this.store.enqueueJob('github', 'issues.open_batch', { op: 'post', card }, { nowMs })
      }
    } else {
      for (const item of routine) {
        this.enqueueSingleIssueOpen(item, nowMs)
      }
    }
  }

  private enqueueSingleIssueOpen(item: IssueBatchItem, nowMs: number): void {
    const state: IssueEntityState = {
      kind: 'issue',
      number: item.number,
      title: item.title,
      url: item.url,
      author: item.author,
      outsider: item.outsider,
      state: 'open',
      stateReason: item.stateReason,
      labels: item.labels,
      assignees: item.assignees,
      commentCount: 0,
      linkedPrNumber: null,
      timeline: ['Opened']
    }
    const critical = hasCriticalLabel(item.labels)
    const claimable = isSpecialIssue(item.labels, false)
    const loud = critical || claimable || item.outsider
    const entityKey = `issue:${item.number}`
    const card = buildIssueCard(state, item.repo, !loud, this.config)

    this.store.enqueueJob(
      'github',
      'issue.opened',
      {
        op: 'upsert_entity',
        entityKey,
        entityType: 'issue',
        card,
        state,
        timeline: state.timeline
      },
      { entityKey, nowMs }
    )

    if (this.config.hasDistinctTriageChannel && critical) {
      this.store.enqueueJob(
        'triage',
        'triage.issue.opened',
        {
          op: 'upsert_entity',
          entityKey: `triage:${entityKey}`,
          entityType: 'issue',
          card: buildIssueCard(state, item.repo, false, this.config),
          state,
          timeline: state.timeline
        },
        { entityKey: `triage:${entityKey}`, nowMs }
      )
    }
  }

  private flushIssueCloseBatch(batch: PendingBatchRecord<IssueBatchItem>, nowMs: number): void {
    const anchored: IssueBatchItem[] = []
    const unanchored: IssueBatchItem[] = []

    for (const item of batch.items) {
      if (this.store.getEntity(`issue:${item.number}`)) {
        anchored.push(item)
      } else {
        unanchored.push(item)
      }
    }

    this.updateAnchoredClosures(anchored, nowMs)

    if (unanchored.length >= 3) {
      const card = buildTriageBatchCard(unanchored, unanchored[0].repo)
      if (card) {
        this.store.enqueueJob('github', 'issues.close_batch', { op: 'post', card }, { nowMs })
      }
    } else {
      for (const item of unanchored) {
        const state: IssueEntityState = {
          kind: 'issue',
          number: item.number,
          title: item.title,
          url: item.url,
          author: item.author,
          outsider: item.outsider,
          state: 'closed',
          stateReason: item.stateReason,
          labels: item.labels,
          assignees: item.assignees,
          commentCount: 0,
          linkedPrNumber: item.closedByPr,
          timeline: ['Closed']
        }
        const card = buildIssueCard(state, item.repo, true, this.config)
        this.store.enqueueJob(
          'github',
          'issue.closed',
          {
            op: 'upsert_entity',
            entityKey: `issue:${item.number}`,
            entityType: 'issue',
            card,
            state,
            timeline: state.timeline
          },
          { entityKey: `issue:${item.number}`, nowMs }
        )
      }
    }
  }

  private flushStarBatch(batch: PendingBatchRecord<StarBatchItem>, nowMs: number): void {
    const items = batch.items
    if (items.length === 0) return
    const card = buildStarCard(items, items[0].repo)
    if (!card) return
    this.store.enqueueJob('github', 'star.batch', { op: 'post', card }, { nowMs })
  }

  async tick(nowMs = Date.now()): Promise<void> {
    if (this.stopped) return
    await this.flushExpiredBatches(nowMs)
    await Promise.all(CHANNELS.map((ch) => this.drainChannel(ch, nowMs)))
  }

  async drainAll(nowMs = Date.now()): Promise<void> {
    await this.flushExpiredBatches(nowMs)
    await Promise.all(CHANNELS.map((ch) => this.drainChannel(ch, nowMs)))
  }

  private async drainChannel(channelKey: ChannelKey, nowMs: number): Promise<void> {
    if (this.inFlight.has(channelKey)) return
    this.inFlight.add(channelKey)
    try {
      while (!this.stopped) {
        const job = this.store.peekNextReadyJob(channelKey, nowMs)
        if (!job) break
        await this.executeJob(job)
      }
    } finally {
      this.inFlight.delete(channelKey)
    }
  }

  private async executeJob(job: QueueJobRecord): Promise<void> {
    const channelId = this.config.channels[job.channelKey]
    const payload = job.payload

    try {
      if (payload.op === 'post') {
        await this.discord.sendMessage(channelId, renderCard(payload.card))
      } else if (payload.op === 'upsert_entity') {
        const existing = payload.forceNew ? null : this.store.getEntity(payload.entityKey)
        const discordPayload = renderCard(payload.card)

        let messageId: string
        if (existing && existing.channelId === channelId) {
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

        this.store.upsertEntity({
          entityKey: payload.entityKey,
          entityType: payload.entityType,
          channelKey: job.channelKey,
          channelId,
          anchorMessageId: messageId,
          state: payload.state,
          timeline: payload.timeline,
          updatedAt: Date.now()
        })
      } else if (payload.op === 'reply_to_entity') {
        let existing = this.store.getEntity(payload.entityKey)
        if (!existing && payload.fallbackAnchor) {
          const createdAnchor = await this.discord.sendMessage(
            channelId,
            renderCard(payload.fallbackAnchor.card)
          )
          existing = {
            entityKey: payload.entityKey,
            entityType: payload.fallbackAnchor.entityType,
            channelKey: job.channelKey,
            channelId,
            anchorMessageId: createdAnchor.id,
            state: payload.fallbackAnchor.state,
            timeline: payload.fallbackAnchor.timeline,
            updatedAt: Date.now()
          }
          this.store.upsertEntity(existing)
        }

        const cardWithRef = existing
          ? { ...payload.card, replyToMessageId: existing.anchorMessageId }
          : payload.card
        await this.discord.sendMessage(channelId, renderCard(cardWithRef))
      }

      this.store.completeJob(job.id)
    } catch (err) {
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
      this.store.rescheduleJob(job.id, Date.now() + backoffMs, nextAttempts)
    }
  }

  async runDigest(kind: 'daily' | 'weekly', opts?: { force?: boolean }): Promise<boolean> {
    const now = new Date()
    const dateKey = now.toISOString().slice(0, 10)
    const runKey = `${kind}:${dateKey}`
    if (!opts?.force && this.store.hasRunKey(runKey)) return false

    const snapshot = await this.github.fetchDigestSnapshot(this.config.githubRepository)
    const card =
      kind === 'daily'
        ? buildDailyTriageDigest(snapshot, this.config)
        : buildWeeklyPulse(snapshot, this.config)

    this.store.markRunKey(runKey, now.getTime())
    if (!card) return false

    const channelKey: ChannelKey = kind === 'daily' ? 'triage' : 'github'
    this.store.enqueueJob(channelKey, `digest.${kind}`, { op: 'post', card })
    await this.drainChannel(channelKey, Date.now())
    return true
  }
}
