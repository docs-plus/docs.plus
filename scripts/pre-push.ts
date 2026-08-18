#!/usr/bin/env bun
/**
 * Manual pre-push quality gate (same final bar as scripts/hooks/pre-push.sh step 4).
 * Does not run selective extension/app builds — use the full git hook for that.
 *
 *   bun run pre-push
 *
 * Skips Prettier --check: pre-commit lint-staged already formats staged files.
 * CI lint job runs lint + format + lint:styles. Typecheck is a second job.
 * For the full local replica of the prod gates, run `bun run check:ci`.
 */

import { $ } from 'bun'

const rootDir = process.cwd()

console.log('🔍 Running check:push (lint + lint:styles + typecheck)...\n')

const result = await $`bun run check:push`.cwd(rootDir)
process.exit(result.exitCode ?? 0)
