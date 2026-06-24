#!/usr/bin/env bun
/**
 * Manual pre-push quality gate (same final bar as scripts/hooks/pre-push.sh step 4).
 * Does not run selective extension/app builds — use the full git hook for that.
 *
 *   bun run pre-push
 *
 * Lint runs with --max-warnings=0 via bun run check.
 */

import { $ } from 'bun'

const rootDir = process.cwd()

console.log('🔍 Running check (lint + lint:styles + format + typecheck)...\n')
console.log('Note: lint enforces --max-warnings=0 repo-wide.\n')

const result = await $`bun run check`.cwd(rootDir)
process.exit(result.exitCode ?? 0)
