#!/usr/bin/env bun

import { $ } from 'bun'

const rootDir = (await $`git rev-parse --show-toplevel`.text()).trim()
const result = await $`sh scripts/hooks/pre-push.sh`.cwd(rootDir)
process.exit(result.exitCode ?? 0)
