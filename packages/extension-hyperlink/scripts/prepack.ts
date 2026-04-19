#!/usr/bin/env bun
/**
 * `prepack` lifecycle hook — runs before `bun publish` AND `bun pm pack`.
 *
 * Syncs the canonical root `LICENSE` into the package directory so it is
 * included in the published tarball. The per-package `LICENSE` is
 * `.gitignore`d so the source tree has a single committed copy at the
 * monorepo root, while every published npm tarball still ships its own
 * `LICENSE` (npm convention; consumed by SPDX scanners and license audit
 * tools at e.g. `node_modules/<pkg>/LICENSE`).
 *
 * Symlinks and hard links don't work for this:
 *   - Symlinks: bun pack silently drops them from the tarball.
 *   - Hard links: work locally for pack, but git stores them as two
 *     independent files, so contributors who clone the repo would get
 *     two copies that can drift silently.
 *
 * `prepack` runs in both pack flows; `prepublishOnly` runs only on
 * publish. Keeping the LICENSE sync here (not in preflight) means
 * `bun pm pack --dry-run` (used for verification) also produces a
 * realistic tarball with LICENSE included.
 */

import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT_LICENSE = join(import.meta.dirname, '..', '..', '..', 'LICENSE')
const PKG_LICENSE = join(import.meta.dirname, '..', 'LICENSE')

if (!existsSync(ROOT_LICENSE)) {
  console.error(`\n\x1b[31m✗ prepack failed\x1b[0m — root LICENSE not found at ${ROOT_LICENSE}\n`)
  process.exit(1)
}

copyFileSync(ROOT_LICENSE, PKG_LICENSE)
console.error(`\x1b[32m✓\x1b[0m prepack: synced LICENSE from monorepo root`)
