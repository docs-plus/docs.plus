/**
 * Pre-push hook: Fast type checking and linting
 * Runs type checking and linting instead of full build for faster feedback
 *
 * Uses Bun APIs for better performance
 *
 * Checks:
 * 1. TypeScript type checking (no emit, fast)
 * 2. ESLint (catches code quality issues)
 */

import { $ } from 'bun'
import path from 'path'

interface Check {
  name: string
  command: string[]
  cwd: string
  description: string
}

const rootDir = process.cwd()
const webappDir = path.join(rootDir, 'packages', 'webapp')

const checks: Check[] = [
  {
    name: 'Type checking',
    command: ['bunx', 'tsc', '--noEmit'],
    cwd: webappDir,
    description: 'Checking TypeScript types...'
  },
  {
    name: 'Linting',
    command: ['bun', 'run', 'lint'],
    cwd: rootDir,
    description: 'Running ESLint...'
  }
]

console.log('🔍 Running pre-push checks...\n')

for (const check of checks) {
  try {
    console.log(`  ✓ ${check.description}`)
    const result = await $`${check.command}`.cwd(check.cwd).quiet()
    if (result.exitCode !== 0) {
      throw new Error(`Exit code: ${result.exitCode}`)
    }
  } catch (_error) {
    console.error(`\n❌ ${check.name} failed. Push aborted.`)
    console.error(`   Fix the errors above and try again.\n`)
    process.exit(1)
  }
}

console.log('\n✅ All checks passed. Proceeding with push.\n')
process.exit(0)
