import type { GitHubApiClient } from '../github/client.ts'
import { hasCriticalLabel } from '../projection/helpers.ts'
import { buildIssueCard, buildTriageBatchCard, isSpecialIssue } from '../projection/issue.ts'
import { buildPushCard } from '../projection/push.ts'
import { buildStarCard, isStarMilestone } from '../projection/star.ts'
import { cleanText } from '../security.ts'
import type { SqliteStore } from '../store/sqliteStore.ts'
import type {
  ChannelKey,
  GitHubIssue,
  IssueBatchItem,
  IssueEntityState,
  PendingBatchRecord,
  PushBatchItem,
  RelayConfig,
  StarBatchItem
} from '../types.ts'

const STAR_COOLDOWN_MS = 24 * 3600_000
const MIN_ISSUE_CLOSE_BURST_MS = 6000

export class EventBatcher {
  private readonly config: RelayConfig
  private readonly store: SqliteStore
  private readonly github: GitHubApiClient
  private flushPromise: Promise<void> | null = null

  constructor(config: RelayConfig, store: SqliteStore, github: GitHubApiClient) {
    this.config = config
    this.store = store
    this.github = github
  }

  async waitForIdle(): Promise<void> {
    if (this.flushPromise) {
      await this.flushPromise.catch(() => {})
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
    const stampedItem: IssueBatchItem = { ...item, receivedAt: item.receivedAt ?? nowMs }
    const items = existing ? [...existing.items, stampedItem] : [stampedItem]
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
    const stampedItem: IssueBatchItem = { ...item, receivedAt: item.receivedAt ?? nowMs }
    const items = existing ? [...existing.items, stampedItem] : [stampedItem]
    const firstAt = items[0].receivedAt ?? existing?.updatedAt ?? nowMs
    const maxFlushAt =
      firstAt + Math.max(this.config.triageBurstWindowMs, this.config.pushCoalesceMs)
    const baseDelay = this.config.pushCoalesceMs
    const burstDelay = Math.max(MIN_ISSUE_CLOSE_BURST_MS, this.config.pushCoalesceMs)
    const desiredFlushAt = items.length >= 2 ? nowMs + burstDelay : nowMs + baseDelay
    const flushAt = Math.min(
      maxFlushAt,
      existing ? Math.max(existing.flushAt, desiredFlushAt) : desiredFlushAt
    )

    this.store.upsertBatch({
      batchKey,
      channelKey: 'github',
      kind: 'issue_close',
      items,
      flushAt,
      updatedAt: nowMs
    })
  }

  mergePendingIssueOpen(issue: GitHubIssue): boolean {
    const batches = this.store.findBatchesByKind('issue_open')
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
    if (this.flushPromise) return this.flushPromise
    const p = this.doFlushExpiredBatches(nowMs).finally(() => {
      if (this.flushPromise === p) this.flushPromise = null
    })
    this.flushPromise = p
    return p
  }

  private async doFlushExpiredBatches(nowMs: number): Promise<void> {
    const expired = this.store.peekExpiredBatches(nowMs)
    if (expired.length === 0) return

    // Hold expired issue_close batches while a push batch for the same repo is still pending.
    const allPushBatches = this.store.findBatchesByKind('push')
    const pendingPushRepos = new Set(
      allPushBatches
        .filter((b) => b.flushAt > nowMs)
        .map((b) => b.items[0]?.repo)
        .filter((repo): repo is string => Boolean(repo))
    )

    const toFlush = expired.filter((batch) => {
      if (batch.kind !== 'issue_close') return true
      const repo = batch.items[0]?.repo
      return !repo || !pendingPushRepos.has(repo)
    })
    if (toFlush.length === 0) return

    // Process push batches before issue_close so correlated closures fold into push cards.
    toFlush.sort((a, b) => (a.kind === 'push' ? -1 : b.kind === 'push' ? 1 : 0))

    // Run async GitHub compareCommits calls BEFORE mutating SQLite so crashes preserve batches.
    const preparedPushes = new Map<string, PushBatchItem[]>()
    for (const batch of toFlush) {
      if (batch.kind !== 'push') continue
      const activeItems = batch.items
        .filter((item) => this.store.findRecentMerge(item.after, 3600_000, nowMs) === null)
        .map((item) => ({
          ...item,
          commits: [...item.commits],
          closedIssues: [...item.closedIssues]
        }))

      for (const item of activeItems) {
        if (item.commits.length >= 20 && item.before && !/^0+$/.test(item.before)) {
          const full = await this.github.compareCommits(item.repo, item.before, item.after)
          if (full && full.length > 0) {
            item.commits = full
          }
        }
      }
      preparedPushes.set(batch.batchKey, activeItems)
    }

    const flushedBatchKeys = new Set(toFlush.map((b) => b.batchKey))
    const expiredCloseItems = toFlush.flatMap((b) => (b.kind === 'issue_close' ? b.items : []))

    this.store.runTransaction(() => {
      const absorbedCloseNumbers = new Set<number>()

      for (const batch of toFlush) {
        this.consumeFlushedBatch(batch.batchKey, batch.items.length, nowMs)

        if (batch.kind === 'push') {
          const activeItems = preparedPushes.get(batch.batchKey) ?? []
          const correlated = this.enqueuePushBatch(
            activeItems,
            expiredCloseItems,
            flushedBatchKeys,
            nowMs
          )
          for (const num of correlated) absorbedCloseNumbers.add(num)
        } else if (batch.kind === 'issue_open') {
          this.flushIssueOpenBatch(batch, nowMs)
        } else if (batch.kind === 'issue_close') {
          const remaining = batch.items.filter((i) => !absorbedCloseNumbers.has(i.number))
          const absorbed = batch.items.filter((i) => absorbedCloseNumbers.has(i.number))
          this.updateAnchoredClosures(absorbed, nowMs)
          if (remaining.length > 0) {
            this.flushIssueCloseBatch({ ...batch, items: remaining }, nowMs)
          }
        } else if (batch.kind === 'star') {
          this.flushStarBatch(batch, nowMs)
        }
      }
    })
  }

  private consumeFlushedBatch(batchKey: string, flushedCount: number, nowMs: number): void {
    const current = this.store.getBatch(batchKey)
    if (!current) return
    if (current.items.length <= flushedCount) {
      this.store.deleteBatch(batchKey)
    } else {
      this.store.upsertBatch({
        ...current,
        items: current.items.slice(flushedCount),
        updatedAt: nowMs
      })
    }
  }

  private closeAnchoredEntity(
    channelKey: ChannelKey,
    kind: string,
    entityKey: string,
    item: IssueBatchItem,
    nowMs: number
  ): void {
    const entity = this.store.getEntity(entityKey)
    if (!entity || entity.state.kind !== 'issue') return
    const state: IssueEntityState = {
      ...entity.state,
      state: 'closed',
      stateReason: item.stateReason || entity.state.stateReason,
      linkedPrNumber: item.closedByPr ?? entity.state.linkedPrNumber,
      timeline: [...entity.state.timeline, 'Closed']
    }
    this.store.enqueueEntityUpsert({
      channelKey,
      channelId: this.config.channels[channelKey],
      kind,
      entityKey,
      entityType: 'issue',
      card: buildIssueCard(state, item.repo, true, this.config),
      state,
      nowMs
    })
  }

  private updateAnchoredClosures(items: IssueBatchItem[], nowMs: number): void {
    for (const item of items) {
      const entityKey = `issue:${item.number}`
      this.closeAnchoredEntity('github', 'issue.closed_anchor', entityKey, item, nowMs)
      if (this.config.hasDistinctTriageChannel) {
        this.closeAnchoredEntity(
          'triage',
          'triage.issue.closed',
          `triage:${entityKey}`,
          item,
          nowMs
        )
      }
    }
  }

  private enqueuePushBatch(
    items: PushBatchItem[],
    expiredCloses: IssueBatchItem[],
    flushedBatchKeys: ReadonlySet<string>,
    nowMs: number
  ): number[] {
    if (items.length === 0) return []

    const pushers = new Set(items.map((p) => p.pusher))
    const explicitClosed = new Set(items.flatMap((p) => p.closedIssues))
    const correlatedNumbers: number[] = []
    const isCorrelated = (closeItem: IssueBatchItem): boolean =>
      closeItem.repo === items[0].repo &&
      (explicitClosed.has(closeItem.number) || pushers.has(closeItem.actor))

    // Absorb matching pending issue_close batches still waiting in SQLite.
    const pendingCloseBatches = this.store.findBatchesByKind('issue_close')
    for (const batch of pendingCloseBatches) {
      if (flushedBatchKeys.has(batch.batchKey)) continue
      const keep: IssueBatchItem[] = []
      const absorb: IssueBatchItem[] = []
      for (const closeItem of batch.items) {
        if (isCorrelated(closeItem)) {
          absorb.push(closeItem)
          correlatedNumbers.push(closeItem.number)
        } else {
          keep.push(closeItem)
        }
      }
      if (absorb.length === 0) continue
      this.updateAnchoredClosures(absorb, nowMs)
      if (keep.length === 0) this.store.deleteBatch(batch.batchKey)
      else this.store.upsertBatch({ ...batch, items: keep, updatedAt: nowMs })
    }

    for (const closeItem of expiredCloses) {
      if (isCorrelated(closeItem)) {
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
      return
    }
    for (const item of routine) {
      this.enqueueSingleIssueOpen(item, nowMs)
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

    this.store.enqueueEntityUpsert({
      channelKey: 'github',
      channelId: this.config.channels.github,
      kind: 'issue.opened',
      entityKey,
      entityType: 'issue',
      card,
      state,
      nowMs
    })

    if (this.config.hasDistinctTriageChannel && critical) {
      this.store.enqueueEntityUpsert({
        channelKey: 'triage',
        channelId: this.config.channels.triage,
        kind: 'triage.issue.opened',
        entityKey: `triage:${entityKey}`,
        entityType: 'issue',
        card: buildIssueCard(state, item.repo, false, this.config),
        state,
        nowMs
      })
    }
  }

  private flushIssueCloseBatch(batch: PendingBatchRecord<IssueBatchItem>, nowMs: number): void {
    const anchored: IssueBatchItem[] = []
    const unanchored: IssueBatchItem[] = []

    for (const item of batch.items) {
      const hasGithub = Boolean(this.store.getEntity(`issue:${item.number}`))
      const hasTriage =
        this.config.hasDistinctTriageChannel &&
        Boolean(this.store.getEntity(`triage:issue:${item.number}`))
      if (hasGithub || hasTriage) {
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
      return
    }
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
      this.store.enqueueEntityUpsert({
        channelKey: 'github',
        channelId: this.config.channels.github,
        kind: 'issue.closed',
        entityKey: `issue:${item.number}`,
        entityType: 'issue',
        card,
        state,
        nowMs
      })
    }
  }

  private flushStarBatch(batch: PendingBatchRecord<StarBatchItem>, nowMs: number): void {
    const items = batch.items
    if (items.length === 0) return
    const card = buildStarCard(items, items[0].repo)
    if (!card) return
    this.store.enqueueJob('github', 'star.batch', { op: 'post', card }, { nowMs })
  }
}
