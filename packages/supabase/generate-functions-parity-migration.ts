#!/usr/bin/env bun
/**
 * Build a single Supabase migration that replays function/trigger/RPC SQL from
 * packages/supabase/scripts (source of truth for local db reset).
 *
 * Excludes table DDL (01–08), RLS (13), lint hardening revokes (29), buckets,
 * cron, demo seeds, and document-views partitions — prod already has schema.
 *
 * Run: bun run generate:functions-parity-migration
 * Then: bunx supabase db push (toggle [db.migrations] enabled = true in config.toml)
 */

import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const rootDir = import.meta.dir
const scriptsDir = join(rootDir, 'scripts')
const migrationsDir = join(rootDir, 'migrations')

/** Intentional subset of scripts/ — not the full generate-seed.ts list. */
const PARITY_SCRIPT_FILES = [
  '07-1-notification-functions.sql',
  '07-3-notification-broadcast.sql',
  '07-4-push-notifications-pgmq.sql',
  '07-5-email-notifications-pgmq.sql',
  '07-bookmark-functions.sql',
  '09-message_counter.sql',
  '10-0-func-helpers.sql',
  '10-1-func-users.sql',
  '10-2-func-channels.sql',
  '10-3-func-message.sql',
  '10-5-func-replied_msg.sql',
  '10-7-func-pinned.sql',
  '10-8-func-workspace_members.sql',
  '10-func-notifications.sql',
  '10-functions.sql',
  '22-user-retention.sql'
] as const

const MIGRATION_BASENAME = '20260519200000_scripts_functions_triggers_parity.sql'

const ON_TABLE_RE = /(?:^|\s)ON\s+(?:ONLY\s+)?((?:(?:public|auth)\.)?[\w.]+)/gi
const TRIGGER_LOOKAHEAD_LINES = 12

function codeWithoutLineComment(line: string): string {
  return line.replace(/--.*$/, '')
}

function parseOnTable(probe: string): string | null {
  ON_TABLE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ON_TABLE_RE.exec(probe)) !== null) {
    if (match[1].toLowerCase() !== 'trigger') {
      return match[1]
    }
  }
  return null
}

/** Prod already has triggers; bare CREATE TRIGGER fails with 42710. */
function makeTriggersIdempotent(sql: string): string {
  const lines = sql.split('\n')
  const out: string[] = []
  let inBlockComment = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (inBlockComment) {
      out.push(line)
      if (line.includes('*/')) {
        inBlockComment = false
      }
      continue
    }

    const blockStart = line.indexOf('/*')
    if (blockStart !== -1 && line.indexOf('*/', blockStart + 2) === -1) {
      inBlockComment = true
      out.push(line)
      continue
    }

    const trimmed = codeWithoutLineComment(line).trimStart()
    const nameMatch = trimmed.match(/^create\s+trigger\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
    if (!nameMatch) {
      out.push(line)
      continue
    }

    const name = nameMatch[1]
    let table: string | null = null
    let j = i

    while (j < lines.length && j < i + TRIGGER_LOOKAHEAD_LINES && table === null) {
      const probe = codeWithoutLineComment(lines[j]).trimStart()

      if (j > i && (/^comment\s+/i.test(probe) || /^create\s+/i.test(probe))) {
        break
      }

      table = parseOnTable(probe)

      if (/execute\s+(?:function|procedure)\s+/i.test(probe)) {
        j++
        break
      }
      j++
    }

    if (!table) {
      out.push(line)
      continue
    }

    const tail = out.slice(-5).join('\n')
    const dropRe = new RegExp(
      `DROP TRIGGER IF EXISTS\\s+${name}\\s+ON\\s+${table.replace(/\./g, '\\.')}`,
      'i'
    )
    if (!dropRe.test(tail)) {
      out.push(`DROP TRIGGER IF EXISTS ${name} ON ${table};`)
    }

    while (i < j) {
      out.push(lines[i])
      i++
    }
    i--
  }

  return out.join('\n')
}

async function main() {
  const parts: string[] = [
    '-- ============================================================================',
    '-- AUTO-GENERATED: functions / triggers / RPC parity for remote Supabase',
    '-- Source: packages/supabase/scripts (see generate-functions-parity-migration.ts)',
    '-- Regenerate: bun run --filter @docs.plus/supabase_back generate:functions-parity-migration',
    '--',
    '-- Idempotent on prod: CREATE OR REPLACE functions; DROP TRIGGER IF EXISTS before CREATE.',
    '-- Does NOT replay table DDL, RLS (13-RLS), or 29-lint-hardening revokes.',
    '-- After editing scripts/: regenerate this file; do not hand-edit.',
    '-- ============================================================================',
    ''
  ]

  let totalBytes = 0
  for (const file of PARITY_SCRIPT_FILES) {
    const content = await readFile(join(scriptsDir, file), 'utf-8')
    totalBytes += content.length
    parts.push(`-- >>> begin ${file}`)
    parts.push(makeTriggersIdempotent(content.trim()))
    parts.push(`-- <<< end ${file}`, '')
  }

  await mkdir(migrationsDir, { recursive: true })
  const outPath = join(migrationsDir, MIGRATION_BASENAME)
  await writeFile(outPath, `${parts.join('\n')}\n`, 'utf-8')

  console.log(`Wrote ${outPath}`)
  console.log(`  Files: ${PARITY_SCRIPT_FILES.length}`)
  console.log(`  Size:  ${(totalBytes / 1024).toFixed(1)} KB (scripts input)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
