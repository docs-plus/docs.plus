const { execSync } = require('child_process')
const path = require('path')

/**
 * Pre-push hook: Fast type checking and linting
 * Runs type checking and linting instead of full build for faster feedback
 *
 * Checks:
 * 1. TypeScript type checking (no emit, fast)
 * 2. ESLint (catches code quality issues)
 *
 * Much faster than full build while catching critical issues
 */

const rootDir = process.cwd()
const webappDir = path.join(rootDir, 'packages', 'webapp')

const checks = [
  {
    name: 'Type checking',
    command: 'bunx tsc --noEmit',
    cwd: webappDir,
    description: 'Checking TypeScript types...'
  },
  {
    name: 'Linting',
    command: 'bun run lint',
    cwd: rootDir,
    description: 'Running ESLint...'
  }
]

console.log('🔍 Running pre-push checks...\n')

for (const check of checks) {
  try {
    console.log(`  ✓ ${check.description}`)
    execSync(check.command, {
      stdio: 'inherit',
      cwd: check.cwd,
      env: { ...process.env }
    })
  } catch (error) {
    console.error(`\n❌ ${check.name} failed. Push aborted.`)
    console.error(`   Fix the errors above and try again.\n`)
    process.exit(1)
  }
}

console.log('\n✅ All checks passed. Proceeding with push.\n')
process.exit(0)

