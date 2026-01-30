#!/usr/bin/env bun
/**
 * Doctor: Health check script for docs.plus development environment
 *
 * Verifies all prerequisites and configurations are correctly set up.
 * Run with: bun scripts/doctor.ts
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more checks failed
 */

import { $ } from 'bun'
import { existsSync } from 'fs'
import { createConnection } from 'net'
import { resolve } from 'path'

// =============================================================================
// Configuration
// =============================================================================

const ROOT_DIR = resolve(import.meta.dir, '..')

const REQUIRED_BUN_VERSION = '1.3.7'
const REQUIRED_NODE_VERSION = '24.0.0'

const REQUIRED_PORTS = [
  { port: 3000, service: 'Webapp' },
  { port: 3100, service: 'Admin Dashboard' },
  { port: 4000, service: 'REST API' },
  { port: 4001, service: 'WebSocket Server' },
  { port: 4002, service: 'Worker' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 6379, service: 'Redis' },
  { port: 54321, service: 'Supabase API' },
  { port: 54323, service: 'Supabase Studio' }
]

const REQUIRED_ENV_FILES = ['.env.development']
const OPTIONAL_ENV_FILES = ['.env.local', '.env.production']

const REQUIRED_TOOLS = [
  { name: 'docker', command: ['docker', '--version'], extract: /Docker version ([\d.]+)/ },
  { name: 'docker-compose', command: ['docker', 'compose', 'version'], extract: /v?([\d.]+)/ },
  { name: 'supabase', command: ['supabase', '--version'], extract: /(\d+\.\d+\.\d+)/ }
]

// =============================================================================
// Types
// =============================================================================

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  message: string
  details?: string
}

// =============================================================================
// Utilities
// =============================================================================

function compareVersions(current: string, required: string): number {
  const currentParts = current.split('.').map(Number)
  const requiredParts = required.split('.').map(Number)

  for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
    const curr = currentParts[i] || 0
    const req = requiredParts[i] || 0
    if (curr > req) return 1
    if (curr < req) return -1
  }
  return 0
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(1000)

    socket.on('connect', () => {
      socket.destroy()
      resolve(true) // Port is in use (service running)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false) // Port is free
    })

    socket.on('error', () => {
      socket.destroy()
      resolve(false) // Port is free
    })
  })
}

async function runCommand(command: string[]): Promise<{ success: boolean; output: string }> {
  try {
    const result = await $`${command}`.quiet().nothrow()
    return {
      success: result.exitCode === 0,
      output: result.stdout.toString().trim() || result.stderr.toString().trim()
    }
  } catch {
    return { success: false, output: '' }
  }
}

function printResult(result: CheckResult) {
  const icons = {
    pass: '✅',
    fail: '❌',
    warn: '⚠️',
    skip: '⏭️'
  }
  const colors = {
    pass: '\x1b[32m',
    fail: '\x1b[31m',
    warn: '\x1b[33m',
    skip: '\x1b[90m'
  }
  const reset = '\x1b[0m'

  console.log(`${icons[result.status]} ${colors[result.status]}${result.name}${reset}: ${result.message}`)
  if (result.details) {
    console.log(`   ${result.details}`)
  }
}

// =============================================================================
// Checks
// =============================================================================

async function checkBunVersion(): Promise<CheckResult> {
  const version = Bun.version

  if (compareVersions(version, REQUIRED_BUN_VERSION) >= 0) {
    return {
      name: 'Bun Version',
      status: 'pass',
      message: `v${version} (required: >=${REQUIRED_BUN_VERSION})`
    }
  }

  return {
    name: 'Bun Version',
    status: 'fail',
    message: `v${version} is below required v${REQUIRED_BUN_VERSION}`,
    details: 'Run: curl -fsSL https://bun.sh/install | bash'
  }
}

async function checkNodeVersion(): Promise<CheckResult> {
  const result = await runCommand(['node', '--version'])

  if (!result.success) {
    return {
      name: 'Node.js Version',
      status: 'warn',
      message: 'Not installed (optional, Bun is primary runtime)'
    }
  }

  const version = result.output.replace('v', '')

  if (compareVersions(version, REQUIRED_NODE_VERSION) >= 0) {
    return {
      name: 'Node.js Version',
      status: 'pass',
      message: `v${version} (fallback runtime)`
    }
  }

  return {
    name: 'Node.js Version',
    status: 'warn',
    message: `v${version} is below v${REQUIRED_NODE_VERSION}`,
    details: 'Some tools may require newer Node.js'
  }
}

async function checkRequiredTools(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  for (const tool of REQUIRED_TOOLS) {
    const result = await runCommand(tool.command)

    if (!result.success) {
      results.push({
        name: tool.name,
        status: 'fail',
        message: 'Not installed',
        details: `Install ${tool.name} to continue`
      })
      continue
    }

    const match = result.output.match(tool.extract)
    const version = match ? match[1] : 'unknown'

    results.push({
      name: tool.name,
      status: 'pass',
      message: `v${version}`
    })
  }

  return results
}

async function checkDockerRunning(): Promise<CheckResult> {
  const result = await runCommand(['docker', 'info'])

  if (result.success) {
    return {
      name: 'Docker Daemon',
      status: 'pass',
      message: 'Running'
    }
  }

  return {
    name: 'Docker Daemon',
    status: 'fail',
    message: 'Not running',
    details: 'Start Docker Desktop or run: sudo systemctl start docker'
  }
}

async function checkEnvFiles(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  for (const file of REQUIRED_ENV_FILES) {
    const path = resolve(ROOT_DIR, file)
    if (existsSync(path)) {
      results.push({
        name: `Env: ${file}`,
        status: 'pass',
        message: 'Found'
      })
    } else {
      results.push({
        name: `Env: ${file}`,
        status: 'fail',
        message: 'Missing',
        details: `Run: cp .env.example ${file}`
      })
    }
  }

  for (const file of OPTIONAL_ENV_FILES) {
    const path = resolve(ROOT_DIR, file)
    if (existsSync(path)) {
      results.push({
        name: `Env: ${file}`,
        status: 'pass',
        message: 'Found (optional)'
      })
    } else {
      results.push({
        name: `Env: ${file}`,
        status: 'skip',
        message: 'Not found (optional)'
      })
    }
  }

  return results
}

async function checkNodeModules(): Promise<CheckResult> {
  const nodeModulesPath = resolve(ROOT_DIR, 'node_modules')
  const bunLockPath = resolve(ROOT_DIR, 'bun.lock')

  if (!existsSync(nodeModulesPath)) {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'node_modules not found',
      details: 'Run: bun install'
    }
  }

  if (!existsSync(bunLockPath)) {
    return {
      name: 'Dependencies',
      status: 'warn',
      message: 'bun.lock not found',
      details: 'Run: bun install to generate lockfile'
    }
  }

  return {
    name: 'Dependencies',
    status: 'pass',
    message: 'Installed'
  }
}

async function checkPrismaClient(): Promise<CheckResult> {
  const prismaClientPath = resolve(
    ROOT_DIR,
    'packages/hocuspocus.server/node_modules/.prisma/client'
  )

  if (existsSync(prismaClientPath)) {
    return {
      name: 'Prisma Client',
      status: 'pass',
      message: 'Generated'
    }
  }

  return {
    name: 'Prisma Client',
    status: 'warn',
    message: 'Not generated',
    details: 'Run: bun run --filter @docs.plus/hocuspocus prisma:generate'
  }
}

async function checkPorts(): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const inUse: string[] = []
  const available: string[] = []

  for (const { port, service } of REQUIRED_PORTS) {
    const isInUse = await checkPort(port)
    if (isInUse) {
      inUse.push(`${port} (${service})`)
    } else {
      available.push(`${port}`)
    }
  }

  if (inUse.length === 0) {
    results.push({
      name: 'Required Ports',
      status: 'pass',
      message: 'All ports available'
    })
  } else if (inUse.length === REQUIRED_PORTS.length) {
    results.push({
      name: 'Required Ports',
      status: 'pass',
      message: 'All services appear to be running',
      details: `In use: ${inUse.join(', ')}`
    })
  } else {
    results.push({
      name: 'Required Ports',
      status: 'warn',
      message: `${inUse.length}/${REQUIRED_PORTS.length} ports in use`,
      details: `In use: ${inUse.join(', ')}`
    })
  }

  return results
}

async function checkGitHooks(): Promise<CheckResult> {
  const huskyPath = resolve(ROOT_DIR, '.husky/_/husky.sh')

  if (existsSync(huskyPath)) {
    return {
      name: 'Git Hooks (Husky)',
      status: 'pass',
      message: 'Configured'
    }
  }

  return {
    name: 'Git Hooks (Husky)',
    status: 'warn',
    message: 'Not initialized',
    details: 'Run: bun run prepare'
  }
}

async function checkSupabaseRunning(): Promise<CheckResult> {
  const isRunning = await checkPort(54321)

  if (isRunning) {
    return {
      name: 'Supabase',
      status: 'pass',
      message: 'Running on port 54321',
      details: 'Studio: http://127.0.0.1:54323'
    }
  }

  return {
    name: 'Supabase',
    status: 'skip',
    message: 'Not running',
    details: 'Start with: make supabase-start'
  }
}

async function checkInfrastructure(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  // Check PostgreSQL
  const pgRunning = await checkPort(5432)
  results.push({
    name: 'PostgreSQL',
    status: pgRunning ? 'pass' : 'skip',
    message: pgRunning ? 'Running on port 5432' : 'Not running',
    details: pgRunning ? undefined : 'Start with: make infra-up'
  })

  // Check Redis
  const redisRunning = await checkPort(6379)
  results.push({
    name: 'Redis',
    status: redisRunning ? 'pass' : 'skip',
    message: redisRunning ? 'Running on port 6379' : 'Not running',
    details: redisRunning ? undefined : 'Start with: make infra-up'
  })

  return results
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('\n🩺 docs.plus Doctor\n')
  console.log('Checking your development environment...\n')
  console.log('─'.repeat(60) + '\n')

  const allResults: CheckResult[] = []
  let hasFailures = false

  // Runtime checks
  console.log('📦 Runtime & Tools\n')
  allResults.push(await checkBunVersion())
  allResults.push(await checkNodeVersion())
  allResults.push(...(await checkRequiredTools()))
  allResults.push(await checkDockerRunning())

  for (const result of allResults) {
    printResult(result)
    if (result.status === 'fail') hasFailures = true
  }

  // Environment checks
  console.log('\n📁 Environment & Configuration\n')
  const envResults: CheckResult[] = []
  envResults.push(...(await checkEnvFiles()))
  envResults.push(await checkNodeModules())
  envResults.push(await checkPrismaClient())
  envResults.push(await checkGitHooks())

  for (const result of envResults) {
    printResult(result)
    if (result.status === 'fail') hasFailures = true
  }
  allResults.push(...envResults)

  // Infrastructure checks
  console.log('\n🐳 Infrastructure Services\n')
  const infraResults: CheckResult[] = []
  infraResults.push(...(await checkInfrastructure()))
  infraResults.push(await checkSupabaseRunning())
  infraResults.push(...(await checkPorts()))

  for (const result of infraResults) {
    printResult(result)
    if (result.status === 'fail') hasFailures = true
  }
  allResults.push(...infraResults)

  // Summary
  console.log('\n' + '─'.repeat(60))

  const passed = allResults.filter((r) => r.status === 'pass').length
  const failed = allResults.filter((r) => r.status === 'fail').length
  const warned = allResults.filter((r) => r.status === 'warn').length
  const skipped = allResults.filter((r) => r.status === 'skip').length

  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed, ${warned} warnings, ${skipped} skipped\n`)

  if (hasFailures) {
    console.log('❌ Some checks failed. Please fix the issues above.\n')
    process.exit(1)
  } else if (warned > 0) {
    console.log('⚠️  All critical checks passed, but there are warnings.\n')
    process.exit(0)
  } else {
    console.log('✅ All checks passed! Your environment is ready.\n')
    console.log('Quick start:')
    console.log('  make infra-up        # Start PostgreSQL + Redis')
    console.log('  make supabase-start  # Start Supabase')
    console.log('  make dev-local       # Start all services\n')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Doctor failed with error:', err)
  process.exit(1)
})
