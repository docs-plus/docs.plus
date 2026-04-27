#!/usr/bin/env bun
/**
 * Manual pre-push quality gate (same final bar as scripts/hooks/pre-push.sh step 4).
 * Does not run selective extension/app builds — use the full git hook for that.
 *
 *   bun run pre-push
 */

import { $ } from 'bun'

const rootDir = process.cwd()

console.log('🔍 Running check (lint + format + styles + types)...\n')

const result = await $`bun run check`.cwd(rootDir)
process.exit(result.exitCode ?? 0)
