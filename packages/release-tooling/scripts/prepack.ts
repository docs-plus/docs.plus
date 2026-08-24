#!/usr/bin/env bun
/**
 * Shared `prepack` hook. Copies root LICENSE into the tarball (per-package copy
 * is gitignored). Do not fork into a package's local scripts/. Symlinks fail
 * (bun pack drops them); hard links fail (they drift).
 */

import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

function findRepoRoot(start: string): string {
  let dir = start
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    dir = dirname(dir)
  }
  throw new Error(`prepack: repo root not found (no bun.lock above ${start})`)
}

const repoRoot = findRepoRoot(process.cwd())
const ROOT_LICENSE = join(repoRoot, 'LICENSE')
const PKG_LICENSE = join(process.cwd(), 'LICENSE')

if (!existsSync(ROOT_LICENSE)) {
  console.error(`\n\x1b[31m✗ prepack failed\x1b[0m — root LICENSE not found at ${ROOT_LICENSE}\n`)
  process.exit(1)
}

copyFileSync(ROOT_LICENSE, PKG_LICENSE)
console.error(`\x1b[32m✓\x1b[0m prepack: synced LICENSE from monorepo root`)
