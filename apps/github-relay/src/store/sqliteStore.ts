import { Database } from 'bun:sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

import type {
  BatchKind,
  ChannelKey,
  EntityRecord,
  EntityState,
  EntityType,
  PendingBatchRecord,
  QueueJobPayload,
  QueueJobRecord
} from '../types.ts'

export class SqliteStore {
  private readonly db: Database

  constructor(sqlitePath: string) {
    if (sqlitePath !== ':memory:') {
      mkdirSync(dirname(sqlitePath), { recursive: true })
    }
    this.db = new Database(sqlitePath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA synchronous = NORMAL;')
    this.db.exec('PRAGMA busy_timeout = 5000;')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        delivery_id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        received_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        entity_key TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        channel_key TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        anchor_message_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        timeline_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS queue_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        entity_key TEXT,
        payload_json TEXT NOT NULL,
        available_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_channel_ready
        ON queue_jobs(channel_key, available_at, id);

      CREATE TABLE IF NOT EXISTS pending_batches (
        batch_key TEXT PRIMARY KEY,
        channel_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        items_json TEXT NOT NULL,
        flush_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pending_batches_flush
        ON pending_batches(flush_at);

      CREATE TABLE IF NOT EXISTS star_cooldowns (
        login TEXT PRIMARY KEY,
        last_notified_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scheduled_runs (
        run_key TEXT PRIMARY KEY,
        ran_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_merges (
        commit_sha TEXT PRIMARY KEY,
        pr_number INTEGER NOT NULL,
        merged_at INTEGER NOT NULL
      );
    `)
  }

  close(): void {
    this.db.close()
  }

  recordDeliveryIfNew(deliveryId: string, eventName: string, nowMs = Date.now()): boolean {
    const res = this.db
      .query(
        'INSERT OR IGNORE INTO deliveries (delivery_id, event_name, received_at) VALUES (?1, ?2, ?3)'
      )
      .run(deliveryId, eventName, nowMs)
    return res.changes > 0
  }

  getEntity(entityKey: string): EntityRecord | null {
    const row = this.db
      .query(
        `SELECT entity_key, entity_type, channel_key, channel_id, anchor_message_id,
                state_json, timeline_json, updated_at
         FROM entities WHERE entity_key = ?1`
      )
      .get(entityKey) as {
      entity_key: string
      entity_type: EntityType
      channel_key: ChannelKey
      channel_id: string
      anchor_message_id: string
      state_json: string
      timeline_json: string
      updated_at: number
    } | null
    if (!row) return null
    return {
      entityKey: row.entity_key,
      entityType: row.entity_type,
      channelKey: row.channel_key,
      channelId: row.channel_id,
      anchorMessageId: row.anchor_message_id,
      state: JSON.parse(row.state_json) as EntityState,
      timeline: JSON.parse(row.timeline_json) as string[],
      updatedAt: row.updated_at
    }
  }

  upsertEntity(record: EntityRecord): void {
    this.db
      .query(
        `INSERT INTO entities (
           entity_key, entity_type, channel_key, channel_id, anchor_message_id,
           state_json, timeline_json, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(entity_key) DO UPDATE SET
           entity_type = excluded.entity_type,
           channel_key = excluded.channel_key,
           channel_id = excluded.channel_id,
           anchor_message_id = excluded.anchor_message_id,
           state_json = excluded.state_json,
           timeline_json = excluded.timeline_json,
           updated_at = excluded.updated_at`
      )
      .run(
        record.entityKey,
        record.entityType,
        record.channelKey,
        record.channelId,
        record.anchorMessageId,
        JSON.stringify(record.state),
        JSON.stringify(record.timeline),
        record.updatedAt
      )
  }

  deleteEntity(entityKey: string): void {
    this.db.query('DELETE FROM entities WHERE entity_key = ?1').run(entityKey)
  }

  enqueueJob(
    channelKey: ChannelKey,
    kind: string,
    payload: QueueJobPayload,
    opts?: { entityKey?: string | null; availableAt?: number; nowMs?: number }
  ): number {
    const nowMs = opts?.nowMs ?? Date.now()
    const availableAt = opts?.availableAt ?? nowMs
    const res = this.db
      .query(
        `INSERT INTO queue_jobs (channel_key, kind, entity_key, payload_json, available_at, attempts, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)`
      )
      .run(channelKey, kind, opts?.entityKey ?? null, JSON.stringify(payload), availableAt, nowMs)
    return Number(res.lastInsertRowid)
  }

  peekNextReadyJob(channelKey: ChannelKey, nowMs = Date.now()): QueueJobRecord | null {
    const row = this.db
      .query(
        `SELECT id, channel_key, kind, entity_key, payload_json, available_at, attempts, created_at
         FROM queue_jobs
         WHERE channel_key = ?1 AND available_at <= ?2
         ORDER BY id ASC
         LIMIT 1`
      )
      .get(channelKey, nowMs) as {
      id: number
      channel_key: ChannelKey
      kind: string
      entity_key: string | null
      payload_json: string
      available_at: number
      attempts: number
      created_at: number
    } | null
    if (!row) return null
    return {
      id: row.id,
      channelKey: row.channel_key,
      kind: row.kind,
      entityKey: row.entity_key,
      payload: JSON.parse(row.payload_json) as QueueJobPayload,
      availableAt: row.available_at,
      attempts: row.attempts,
      createdAt: row.created_at
    }
  }

  completeJob(id: number): void {
    this.db.query('DELETE FROM queue_jobs WHERE id = ?1').run(id)
  }

  rescheduleJob(id: number, nextAvailableAt: number, attempts: number): void {
    this.db
      .query('UPDATE queue_jobs SET available_at = ?2, attempts = ?3 WHERE id = ?1')
      .run(id, nextAvailableAt, attempts)
  }

  countPendingJobs(): number {
    const row = this.db.query('SELECT COUNT(*) AS cnt FROM queue_jobs').get() as { cnt: number }
    return row.cnt
  }

  getBatch<T = unknown>(batchKey: string): PendingBatchRecord<T> | null {
    const row = this.db
      .query(
        `SELECT batch_key, channel_key, kind, items_json, flush_at, updated_at
         FROM pending_batches WHERE batch_key = ?1`
      )
      .get(batchKey) as {
      batch_key: string
      channel_key: ChannelKey
      kind: BatchKind
      items_json: string
      flush_at: number
      updated_at: number
    } | null
    if (!row) return null
    return {
      batchKey: row.batch_key,
      channelKey: row.channel_key,
      kind: row.kind,
      items: JSON.parse(row.items_json) as T[],
      flushAt: row.flush_at,
      updatedAt: row.updated_at
    }
  }

  findBatchesByKind(kind: BatchKind): PendingBatchRecord[] {
    const rows = this.db
      .query(
        `SELECT batch_key, channel_key, kind, items_json, flush_at, updated_at
         FROM pending_batches WHERE kind = ?1 ORDER BY flush_at ASC`
      )
      .all(kind) as Array<{
      batch_key: string
      channel_key: ChannelKey
      kind: BatchKind
      items_json: string
      flush_at: number
      updated_at: number
    }>
    return rows.map((row) => ({
      batchKey: row.batch_key,
      channelKey: row.channel_key,
      kind: row.kind,
      items: JSON.parse(row.items_json) as unknown[],
      flushAt: row.flush_at,
      updatedAt: row.updated_at
    }))
  }

  upsertBatch<T = unknown>(batch: PendingBatchRecord<T>): void {
    this.db
      .query(
        `INSERT INTO pending_batches (batch_key, channel_key, kind, items_json, flush_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(batch_key) DO UPDATE SET
           items_json = excluded.items_json,
           flush_at = excluded.flush_at,
           updated_at = excluded.updated_at`
      )
      .run(
        batch.batchKey,
        batch.channelKey,
        batch.kind,
        JSON.stringify(batch.items),
        batch.flushAt,
        batch.updatedAt
      )
  }

  deleteBatch(batchKey: string): void {
    this.db.query('DELETE FROM pending_batches WHERE batch_key = ?1').run(batchKey)
  }

  takeExpiredBatches(nowMs = Date.now()): PendingBatchRecord[] {
    const tx = this.db.transaction((ts: number): PendingBatchRecord[] => {
      const rows = this.db
        .query(
          `SELECT batch_key, channel_key, kind, items_json, flush_at, updated_at
           FROM pending_batches WHERE flush_at <= ?1 ORDER BY flush_at ASC`
        )
        .all(ts) as Array<{
        batch_key: string
        channel_key: ChannelKey
        kind: BatchKind
        items_json: string
        flush_at: number
        updated_at: number
      }>
      if (rows.length > 0) {
        this.db.query('DELETE FROM pending_batches WHERE flush_at <= ?1').run(ts)
      }
      return rows.map((row) => ({
        batchKey: row.batch_key,
        channelKey: row.channel_key,
        kind: row.kind,
        items: JSON.parse(row.items_json) as unknown[],
        flushAt: row.flush_at,
        updatedAt: row.updated_at
      }))
    })
    return tx(nowMs)
  }

  isStarOnCooldown(login: string, cooldownMs: number, nowMs = Date.now()): boolean {
    const row = this.db
      .query('SELECT last_notified_at FROM star_cooldowns WHERE login = ?1')
      .get(login.toLowerCase()) as { last_notified_at: number } | null
    if (!row) return false
    return nowMs - row.last_notified_at < cooldownMs
  }

  markStarNotified(login: string, nowMs = Date.now()): void {
    this.db
      .query(
        `INSERT INTO star_cooldowns (login, last_notified_at) VALUES (?1, ?2)
         ON CONFLICT(login) DO UPDATE SET last_notified_at = excluded.last_notified_at`
      )
      .run(login.toLowerCase(), nowMs)
  }

  hasRunKey(runKey: string): boolean {
    const row = this.db
      .query('SELECT 1 AS ok FROM scheduled_runs WHERE run_key = ?1')
      .get(runKey) as { ok: number } | null
    return row !== null
  }

  markRunKey(runKey: string, nowMs = Date.now()): void {
    this.db
      .query('INSERT OR IGNORE INTO scheduled_runs (run_key, ran_at) VALUES (?1, ?2)')
      .run(runKey, nowMs)
  }

  recordRecentMerge(commitSha: string, prNumber: number, nowMs = Date.now()): void {
    if (!commitSha) return
    this.db
      .query(
        `INSERT INTO recent_merges (commit_sha, pr_number, merged_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(commit_sha) DO UPDATE SET pr_number = excluded.pr_number, merged_at = excluded.merged_at`
      )
      .run(commitSha, prNumber, nowMs)
  }

  findRecentMerge(commitSha: string, maxAgeMs = 3600_000, nowMs = Date.now()): number | null {
    if (!commitSha) return null
    const row = this.db
      .query('SELECT pr_number, merged_at FROM recent_merges WHERE commit_sha = ?1')
      .get(commitSha) as { pr_number: number; merged_at: number } | null
    if (!row) return null
    if (nowMs - row.merged_at > maxAgeMs) return null
    return row.pr_number
  }

  pruneOldRecords(nowMs = Date.now()): void {
    this.db.query('DELETE FROM deliveries WHERE received_at < ?1').run(nowMs - 14 * 86400_000)
    this.db
      .query('DELETE FROM star_cooldowns WHERE last_notified_at < ?1')
      .run(nowMs - 48 * 3600_000)
    this.db.query('DELETE FROM recent_merges WHERE merged_at < ?1').run(nowMs - 2 * 3600_000)
  }
}
