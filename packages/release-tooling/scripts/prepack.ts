#!/usr/bin/env bun
/**
 * Shared `prepack` hook ("prepack": "release-prepack") — never fork it into a
 * package's local `scripts/` (AGENTS.md "Shared Library Config"). Copies the root
 * `LICENSE` in so the tarball ships one, because the per-package copy is
 * `.gitignore`d. Symlinks fail (bun pack drops them) and hard links fail (they drift).
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
