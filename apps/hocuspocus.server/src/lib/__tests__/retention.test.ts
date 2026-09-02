import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'

import { createRetention, reapCutoff } from '../retention'

const silent = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
} as unknown as Logger

interface Capture {
  sql: string[]
  values: unknown[][]
  metadataFinds: unknown[]
}

const harness = (over: Record<string, unknown> = {}) => {
  const capture: Capture = { sql: [], values: [], metadataFinds: [] }
  const prisma = {
    emailSentLog: { deleteMany: async () => ({ count: 0 }) },
    pushSentLog: { deleteMany: async () => ({ count: 0 }) },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      capture.sql.push(strings.join('?'))
      capture.values.push(values)
      return 0
    },
    documentMetadata: {
      findMany: async (args: unknown) => {
        capture.metadataFinds.push(args)
        return []
      },
      findUnique: async () => null
    },
    ...over
  } as unknown as PrismaClient

  return { capture, prisma }
}

describe('retention', () => {
  test('thins by document and calendar day, keeping each day newest row', () => {
    // The window function is the whole rule. Nothing else in the build reads it,
    // and before this module it sat behind a top-level await.
    const { capture, prisma } = harness()
    return createRetention({
      prisma,
      purge: null,
      logger: silent,
      autosaveRetentionDays: 30,
      deleteRetentionDays: 30
    })
      .run()
      .then(() => {
        const sql = capture.sql.join(' ').replace(/\s+/g, ' ')
        expect(sql).toContain('PARTITION BY "documentId", date_trunc(\'day\', "createdAt")')
        expect(sql).toContain('ORDER BY version DESC')
        expect(sql).toContain('WHERE day_rank > 1')
      })
  })

  test('exempts a name a person typed, and never the names the server mints', async () => {
    // Widening this predicate back to a commitMessage text test is what the
    // trigger column was added to prevent.
    const { capture, prisma } = harness()
    await createRetention({
      prisma,
      purge: null,
      logger: silent,
      autosaveRetentionDays: 30,
      deleteRetentionDays: 0
    }).run()

    const sql = capture.sql.join(' ').replace(/\s+/g, ' ')
    expect(sql).toContain('"commitMessage" IS NULL OR "commitMessage" = \'\'')
    expect(sql).toContain('"trigger" IN')
    // `Prisma.join` arrives as one Sql fragment, so the names sit on its values.
    const bound = capture.values.flat().flatMap((v) => (v as { values?: unknown[] })?.values ?? [v])
    expect(bound).toContain('revert-backup')
    expect(bound).toContain('schema-migration')
  })

  test('a zero retention window disables the pass rather than deleting everything', async () => {
    const { capture, prisma } = harness()
    await createRetention({
      prisma,
      purge: null,
      logger: silent,
      autosaveRetentionDays: 0,
      deleteRetentionDays: 0
    }).run()
    expect(capture.sql).toEqual([])
  })

  test('the reaper needs a Supabase client and skips without one', async () => {
    const { capture, prisma } = harness()
    await createRetention({
      prisma,
      purge: null,
      logger: silent,
      autosaveRetentionDays: 0,
      deleteRetentionDays: 30
    }).run()
    expect(capture.metadataFinds).toEqual([])
  })

  test('the reaper takes the oldest tombstones first', async () => {
    // A batch that all fails burns one pass. Newest-first would starve the
    // oldest tombstones forever.
    const { capture, prisma } = harness()
    await createRetention({
      prisma,
      purge: async () => ({ purged: 0 }),
      logger: silent,
      autosaveRetentionDays: 0,
      deleteRetentionDays: 30
    }).run()
    expect(capture.metadataFinds[0]).toMatchObject({ orderBy: { deletedAt: 'asc' } })
  })

  test('reapCutoff walks back whole days from now', () => {
    const now = Date.UTC(2026, 0, 31)
    expect(reapCutoff(30, now).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
})
