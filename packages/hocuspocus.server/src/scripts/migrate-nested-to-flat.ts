#!/usr/bin/env bun
/**
 * Batch migration: nested heading schema → flat heading schema
 *
 * Usage:
 *   bun run src/scripts/migrate-nested-to-flat.ts              # migrate all
 *   bun run src/scripts/migrate-nested-to-flat.ts --dry-run    # audit only
 *   bun run src/scripts/migrate-nested-to-flat.ts --doc <id>   # single document
 */

import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../lib/migration-extensions'
import { prisma, shutdownDatabase } from '../lib/prisma'
import { isOldSchema, transformNestedToFlat } from '../lib/schema-migration'

const BATCH_SIZE = 50
const COMMIT_MESSAGE = 'schema-migration: nested-to-flat'

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  errors: number
  errorIds: string[]
}

function parseArgs(): { dryRun: boolean; docId: string | null } {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    docId: args.includes('--doc') ? (args[args.indexOf('--doc') + 1] ?? null) : null
  }
}

function ydocToPmJson(data: Buffer | Uint8Array): Record<string, unknown> | null {
  try {
    const ydoc = new Y.Doc()
    const buffer = data instanceof Buffer ? new Uint8Array(data) : data
    Y.applyUpdate(ydoc, buffer)
    return TiptapTransformer.fromYdoc(ydoc, 'default') as Record<string, unknown> | null
  } catch {
    return null
  }
}

function pmJsonToYdocBytes(json: Record<string, unknown>): Uint8Array {
  const ydoc = TiptapTransformer.toYdoc(json, 'default', migrationExtensions)
  return Y.encodeStateAsUpdate(ydoc)
}

async function getDocumentIds(docId: string | null): Promise<string[]> {
  if (docId) return [docId]

  const docs = await prisma.documents.findMany({
    distinct: ['documentId'],
    select: { documentId: true }
  })
  return docs.map((d) => d.documentId)
}

async function migrateDocument(
  documentId: string,
  dryRun: boolean
): Promise<'migrated' | 'skipped' | 'error'> {
  try {
    const doc = await prisma.documents.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { data: true, version: true }
    })

    if (!doc?.data) return 'skipped'

    const pmJson = ydocToPmJson(doc.data)
    if (!pmJson) {
      console.error(`  [${documentId}] Failed to parse Yjs → PM JSON`)
      return 'error'
    }

    if (!isOldSchema(pmJson as any)) return 'skipped'

    const flatJson = transformNestedToFlat(pmJson as any)

    if (dryRun) {
      const oldHeadings = JSON.stringify(pmJson).match(/"contentHeading"/g)?.length ?? 0
      console.log(`  [${documentId}] WOULD migrate (${oldHeadings} nested headings found)`)
      return 'migrated'
    }

    const newBytes = pmJsonToYdocBytes(flatJson as unknown as Record<string, unknown>)

    await prisma.documents.create({
      data: {
        documentId,
        version: doc.version + 1,
        commitMessage: COMMIT_MESSAGE,
        data: Buffer.from(newBytes)
      }
    })

    return 'migrated'
  } catch (err) {
    console.error(`  [${documentId}] Error:`, err instanceof Error ? err.message : err)
    return 'error'
  }
}

async function main() {
  const { dryRun, docId } = parseArgs()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Schema Migration: Nested → Flat`)
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  if (docId) console.log(`  Target: ${docId}`)
  console.log(`${'='.repeat(60)}\n`)

  const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0, errorIds: [] }

  try {
    const documentIds = await getDocumentIds(docId)
    stats.total = documentIds.length

    console.log(`Found ${stats.total} document(s) to process\n`)

    for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
      const batch = documentIds.slice(i, i + BATCH_SIZE)

      for (const id of batch) {
        const result = await migrateDocument(id, dryRun)

        switch (result) {
          case 'migrated':
            stats.migrated++
            if (!dryRun)
              console.log(`  [${i + batch.indexOf(id) + 1}/${stats.total}] ${id}: migrated`)
            break
          case 'skipped':
            stats.skipped++
            break
          case 'error':
            stats.errors++
            stats.errorIds.push(id)
            break
        }
      }

      if (i + BATCH_SIZE < documentIds.length) {
        console.log(`  ... processed ${Math.min(i + BATCH_SIZE, stats.total)}/${stats.total}`)
      }
    }
  } finally {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`  Results:`)
    console.log(`    Total:    ${stats.total}`)
    console.log(`    Migrated: ${stats.migrated}`)
    console.log(`    Skipped:  ${stats.skipped} (already flat)`)
    console.log(`    Errors:   ${stats.errors}`)
    if (stats.errorIds.length > 0) {
      console.log(`    Failed:   ${stats.errorIds.join(', ')}`)
    }
    if (dryRun) {
      console.log(`\n  This was a DRY RUN. No changes were written.`)
    }
    console.log(`${'='.repeat(60)}\n`)

    await shutdownDatabase()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
