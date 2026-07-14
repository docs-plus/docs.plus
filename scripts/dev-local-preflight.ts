#!/usr/bin/env bun
/**
 * Internal bootstrap for `make dev-local` / `make dev-backend` (not a public CLI).
 * Install, infra, migrate, extension dist — then Make starts the processes.
 */

import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { createConnection } from 'net'
import { dirname, resolve } from 'path'

import { PUBLISHABLE_EXTENSION_DIRS } from './publishable-extensions'

const ROOT = resolve(import.meta.dir, '..')
const STAMP = resolve(ROOT, 'node_modules/.docsplus-install-stamp')

const enginesBun = (
  JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    engines?: { bun?: string }
  }
).engines?.bun
const REQUIRED_BUN = (enginesBun?.replace(/^[^0-9]*/, '') || '1.3.7') as string

function fail(msg: string, hint?: string): never {
  console.error(`✗ ${msg}`)
  if (hint) console.error(`  → ${hint}`)
  process.exit(1)
}

function note(msg: string) {
  console.log(`• ${msg}`)
}

function bunTooOld(current: string, required: string): boolean {
  const a = current.split('.').map(Number)
  const b = required.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0)
  }
  return false
}

async function portOpen(port: number, ms = 400): Promise<boolean> {
  return new Promise((done) => {
    const s = createConnection({ port, host: '127.0.0.1' })
    s.setTimeout(ms)
    const finish = (v: boolean) => {
      s.destroy()
      done(v)
    }
    s.on('connect', () => finish(true))
    s.on('timeout', () => finish(false))
    s.on('error', () => finish(false))
  })
}

async function sh(cmd: string[], quiet = false): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd: ROOT,
    stdout: quiet ? 'pipe' : 'inherit',
    stderr: quiet ? 'pipe' : 'inherit'
  })
  if (!quiet) return proc.exited

  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  if (code !== 0) {
    if (stdout.trim()) console.error(stdout.trimEnd())
    if (stderr.trim()) console.error(stderr.trimEnd())
  }
  return code
}

function lockMtime(): string {
  return String(statSync(resolve(ROOT, 'bun.lock')).mtimeMs)
}

function needsInstall(): boolean {
  if (!existsSync(resolve(ROOT, 'node_modules')) || !existsSync(resolve(ROOT, 'bun.lock'))) {
    return true
  }
  try {
    Bun.resolveSync('next', resolve(ROOT, 'apps/webapp'))
    Bun.resolveSync('@docs.plus/extension-hyperlink', resolve(ROOT, 'apps/webapp'))
  } catch {
    return true
  }
  // Stamp: no-op `bun install` does not bump node_modules mtime, so lockfile
  // mtime alone vs directory mtime would reinstall every run.
  if (!existsSync(STAMP)) return true
  return readFileSync(STAMP, 'utf8').trim() !== lockMtime()
}

function newestMtimeMs(dir: string): number {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    newest = Math.max(newest, entry.isDirectory() ? newestMtimeMs(path) : statSync(path).mtimeMs)
  }
  return newest
}

// The webapp resolves built dist/, so a git pull touching src/ without a
// rebuild silently serves stale extensions — compare mtimes, not just presence.
export function needsExtensionBuild(): boolean {
  const packageDirs = [
    ...(['floating-popover', 'floating-tooltip'] as const).map((name) => `packages/${name}`),
    ...PUBLISHABLE_EXTENSION_DIRS.map((dir) => `extensions/${dir}`)
  ]
  for (const pkg of packageDirs) {
    const dist = resolve(ROOT, `${pkg}/dist/index.js`)
    if (!existsSync(dist)) return true
    if (newestMtimeMs(resolve(ROOT, `${pkg}/src`)) > statSync(dist).mtimeMs) return true
  }
  return false
}

// .env.development is Docker-shaped (service hostnames, compose-provided
// DATABASE_URL); native processes need localhost values and an explicit URL.
const LOCAL_HOST_OVERRIDES: Record<string, string> = {
  REDIS_HOST: 'localhost',
  SERVER_RESTAPI_URL: 'http://localhost:4000/api',
  SUPABASE_URL: 'http://localhost:54321'
}

export function localizeEnvForHost(content: string): string {
  const envValue = (key: string, fallback: string) =>
    content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() || fallback

  let out = content
  for (const [key, value] of Object.entries(LOCAL_HOST_OVERRIDES)) {
    const line = new RegExp(`^${key}=.*$`, 'm')
    out = line.test(out)
      ? out.replace(line, `${key}=${value}`)
      : `${out.trimEnd()}\n${key}=${value}\n`
  }
  if (!/^DATABASE_URL=/m.test(out)) {
    const user = envValue('DB_USER', 'docsplus')
    const password = envValue('DB_PASSWORD', 'CHANGE_ME_STRONG_PASSWORD')
    const port = envValue('DB_PORT', '5432')
    const url = `postgresql://${user}:${password}@localhost:${port}/docsplus?connection_limit=10&pool_timeout=10&sslmode=prefer`
    out = `${out.trimEnd()}\nDATABASE_URL=${url}\n`
  }
  return out
}

function envKeys(path: string): Set<string> {
  return new Set([...readFileSync(path, 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]))
}

async function ensureEnv(): Promise<void> {
  const local = resolve(ROOT, '.env.local')
  const example = resolve(ROOT, '.env.example')
  if (existsSync(local)) {
    if (!existsSync(example)) return
    const missing = [...envKeys(example)].filter((k) => !envKeys(local).has(k))
    if (missing.length) note(`.env.local lacks keys from .env.example: ${missing.join(', ')}`)
    return
  }
  const dev = resolve(ROOT, '.env.development')
  if (!existsSync(dev)) {
    if (!existsSync(example))
      fail('.env.local missing', 'No .env.development or .env.example to bootstrap from')
    copyFileSync(example, dev)
    note('Created .env.development from .env.example')
  }
  writeFileSync(local, localizeEnvForHost(readFileSync(dev, 'utf8')))
  note(
    'Created .env.local from .env.development (localhost + DATABASE_URL applied) — review secrets'
  )
}

async function ensureInstall(): Promise<void> {
  if (bunTooOld(Bun.version, REQUIRED_BUN)) {
    fail(`Bun v${Bun.version} < v${REQUIRED_BUN}`, 'curl -fsSL https://bun.sh/install | bash')
  }
  if (!needsInstall()) return
  note('bun install…')
  if ((await sh(['bun', 'install'])) !== 0) fail('bun install failed')
  writeFileSync(STAMP, lockMtime())
}

async function ensureInfra(): Promise<void> {
  const [pg, redis] = await Promise.all([
    sh(['docker', 'exec', 'docsy-postgres-local', 'pg_isready', '-U', 'docsplus'], true),
    sh(['docker', 'exec', 'docsy-redis-local', 'redis-cli', 'ping'], true)
  ])
  if (pg === 0 && redis === 0) return

  note('Starting infrastructure… (first run pulls Postgres/Redis images — may take a few minutes)')
  if (
    (await sh(
      [
        'docker',
        'compose',
        '-f',
        'docker-compose.local.yml',
        '--env-file',
        '.env.local',
        'up',
        '-d',
        '--wait'
      ],
      true
    )) !== 0
  ) {
    fail('Infrastructure failed (Postgres/Redis)', 'Start Docker Desktop, then: make infra-up')
  }
}

async function ensureSupabase(): Promise<void> {
  if (!(await portOpen(54321))) {
    note('Starting Supabase… (first run downloads Docker images — may take several minutes)')
    if ((await sh(['bun', '--filter', '@docs.plus/supabase_back', 'start'])) !== 0) {
      fail('Supabase failed to start', 'bun --filter @docs.plus/supabase_back start')
    }
    let ready = false
    for (let i = 0; i < 60 && !ready; i++) {
      ready = await portOpen(54321)
      if (!ready) await Bun.sleep(500)
    }
    if (!ready) fail('Supabase did not become ready on :54321')
  }
  // :54321 is every project's default — confirm it is ours and the seed applied.
  const probe = await sh(
    [
      'docker',
      'exec',
      'supabase_db_docsplus_supabase',
      'psql',
      '-U',
      'postgres',
      '-tAc',
      'select 1 from public.workspaces limit 1'
    ],
    true
  )
  if (probe !== 0) {
    fail(
      'Supabase on :54321 is not the seeded docs.plus instance',
      "Another project's Supabase? Stop it first. Empty database? bun --filter @docs.plus/supabase_back reset"
    )
  }
}

// Package presence is not generation: postinstall's `|| true` can mask a failed
// generate, so check the emitted client (works in isolated and hoisted layouts).
function prismaClientGenerated(): boolean {
  try {
    const entry = Bun.resolveSync('@prisma/client', resolve(ROOT, 'apps/hocuspocus.server'))
    return existsSync(resolve(dirname(entry), '../../.prisma/client'))
  } catch {
    return false
  }
}

async function ensurePrisma(): Promise<void> {
  if (!prismaClientGenerated()) {
    note('prisma generate…')
    if ((await sh(['bun', '--filter', '@docs.plus/hocuspocus', 'prisma:generate'])) !== 0) {
      fail('prisma generate failed')
    }
  }

  // Always deploy: idempotent; empty volumes caused DocumentMetadata 500.
  if (
    (await sh(['bun', '--filter', '@docs.plus/hocuspocus', 'prisma:migrate:deploy'], true)) !== 0
  ) {
    fail('prisma migrate deploy failed', 'Check DATABASE_URL in .env.local → docsy-postgres-local')
  }
}

async function ensureExtensionDists(): Promise<void> {
  if (!needsExtensionBuild()) return
  note('Building extension dist/…')
  if ((await sh(['bash', 'scripts/build-extensions.sh'])) !== 0) {
    fail('Extension build failed', 'bash scripts/build-extensions.sh')
  }
}

async function main() {
  const t0 = performance.now()
  console.log('docs.plus preflight')

  await ensureEnv()
  await ensureInstall()
  await ensureInfra()
  // Serial mutates: clear logs, no partial exit mid-sibling (staff review).
  await ensureSupabase()
  await ensurePrisma()
  await ensureExtensionDists()

  console.log(
    `✓ ready (${Math.round(performance.now() - t0)}ms)  open http://localhost:3000 (Next shifts to the next free port if 3000 is busy — see WEBAPP log)  api :4000  studio :54323\n`
  )
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
