#!/usr/bin/env bun
/**
 * Shared `prepack` lifecycle hook for docs.plus publishable libraries.
 *
 * Syncs the canonical root `LICENSE` into the consuming package directory
 * so it is included in the published tarball. The per-package `LICENSE`
 * is `.gitignore`d so the source tree has a single committed copy at the
 * monorepo root, while every published npm tarball still ships its own
 * `LICENSE` (npm convention; consumed by SPDX scanners and license audit
 * tools at `node_modules/<pkg>/LICENSE`).
 *
 * Symlinks (bun pack drops them) and hard links (git stores them as two
 * independent files that drift) both fail; copy is the only correct
 * mechanism.
 *
 * Consumed by every publishable library via:
 *   "prepack": "release-prepack"
 * Never copy this script into a package's local `scripts/` directory —
 * the rule is enforced in AGENTS.md "Shared Library Config".
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
