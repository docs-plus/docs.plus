/**
 * Real-infra E2E for two fleet-wide limits: the Redis retention lease and the
 * media-read rate-limit bucket. Both need real Redis, and the unit job has none.
 *
 * Run as a standalone process, NOT `bun test`. Section [1] spawns this same file
 * as two child processes, which is the production condition the lease exists for.
 * Requires REDIS_HOST/REDIS_PORT. Set REDIS_DB to a scratch database.
 *
 * Every check carries a control. A lease test that sees one run proves nothing
 * unless the unleased control shows two.
 */
import { Hono } from 'hono'

import { HYPERMULTIMEDIA_MOUNT_PATH } from '../src/api/routers/hypermultimedia.router'
import { config } from '../src/config/env'
import { disconnectRedis, getRedisClient } from '../src/lib/redis'
import { withRedisLease } from '../src/lib/redisLease'
import { createRevertCooldown } from '../src/lib/revertCooldown'
import { MEDIA_READ_BUDGET_FACTOR, setupMiddleware } from '../src/middleware'

// Child mode: acquire once, print the outcome, exit. The parent reads stdout.
if (process.env.E2E_LEASE_CHILD) {
  const childRedis = getRedisClient()
  if (!childRedis) {
    console.log('no-redis')
    process.exit(0)
  }
  const work = async (): Promise<void> => {
    await Bun.sleep(200)
  }
  let outcome: string
  if (process.env.E2E_LEASE_CHILD === 'unleased') {
    outcome = await work().then(() => 'ran')
  } else if (process.env.E2E_LEASE_CHILD === 'revert') {
    const cooldown = createRevertCooldown(childRedis)
    outcome = (await cooldown.coolingDown(process.env.E2E_LEASE_KEY!)) ? 'refused' : 'allowed'
  } else if (process.env.E2E_LEASE_CHILD === 'revert-local') {
    // Control: no Redis, so each process falls back to its own in-memory Map.
    const cooldown = createRevertCooldown(null)
    outcome = (await cooldown.coolingDown(process.env.E2E_LEASE_KEY!)) ? 'refused' : 'allowed'
  } else {
    outcome = await withRedisLease(childRedis, process.env.E2E_LEASE_KEY!, 30, work)
  }
  console.log(outcome)
  await disconnectRedis()
  process.exit(0)
}

let failed = false
const check = (cond: boolean, msg: string): void => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failed = true
}

const runChildren = async (mode: string, key: string): Promise<string[]> => {
  const spawn = () =>
    Bun.spawn([process.execPath, import.meta.path], {
      env: { ...process.env, E2E_LEASE_CHILD: mode, E2E_LEASE_KEY: key },
      stdout: 'pipe',
      stderr: 'ignore'
    })
  // Started together on purpose: both must reach SET NX inside the same window.
  const [a, b] = [spawn(), spawn()]
  const out = await Promise.all([new Response(a.stdout).text(), new Response(b.stdout).text()])
  await Promise.all([a.exited, b.exited])
  return out.map((o) => o.trim().split('\n').pop() ?? '')
}

const redis = getRedisClient()
if (!redis) {
  console.error('✗ Redis is required. Set REDIS_HOST and REDIS_PORT.')
  process.exit(1)
}

const stamp = Date.now()

console.log('\n[1] Redis lease — two real processes')
{
  const key = `e2e-lease-${stamp}-a`
  const outcomes = await runChildren('1', key)
  const ran = outcomes.filter((o) => o === 'ran').length
  const skipped = outcomes.filter((o) => o === 'skipped').length
  check(ran === 1, `exactly one process ran (got ${ran}, outcomes: ${outcomes.join(',')})`)
  check(skipped === 1, `the other skipped (got ${skipped})`)

  // Control: without the lease the same harness sees two runs. Without this, a
  // single "ran" could just mean the second child died.
  const control = await runChildren('unleased', `${key}-control`)
  const controlRan = control.filter((o) => o === 'ran').length
  check(controlRan === 2, `CONTROL unleased: both ran (got ${controlRan})`)

  await redis.del(key)
}

console.log('\n[2] Redis lease — expiry and fault arms')
{
  const key = `e2e-lease-${stamp}-b`
  let runs = 0
  const work = async (): Promise<void> => {
    runs += 1
  }

  check((await withRedisLease(redis, key, 1, work)) === 'ran', 'first acquire runs')
  check((await withRedisLease(redis, key, 1, work)) === 'skipped', 'second is skipped while held')
  await Bun.sleep(1200)
  check((await withRedisLease(redis, key, 1, work)) === 'ran', 'runs again once the lease expires')
  check(runs === 2, `work ran twice, never during the hold (got ${runs})`)

  // A Redis that cannot answer must not stop the sweep.
  const faulty = {
    set: async () => {
      throw new Error('redis down')
    }
  } as unknown as typeof redis
  let faultRuns = 0
  const outcome = await withRedisLease(faulty, key, 1, async () => {
    faultRuns += 1
  })
  check(outcome === 'ran-unleased', `a store fault runs unleased (got ${outcome})`)
  check(faultRuns === 1, 'the work still ran on the fault arm')

  await redis.del(key)
}

console.log('\n[3] Media-read bucket — method-scoped, not an exemption')
{
  const app = new Hono()
  setupMiddleware(app)
  // Mounted from the shared constant, so renaming the real mount fails this test
  // instead of silently killing the bucket.
  app.get(`${HYPERMULTIMEDIA_MOUNT_PATH}/:documentId/:mediaId`, (c) => c.text('media'))
  app.post(`${HYPERMULTIMEDIA_MOUNT_PATH}/:documentId`, (c) => c.text('upload'))
  app.get('/api/documents', (c) => c.text('documents'))

  const max = config.security.rateLimitMax
  const fire = async (method: string, path: string, ip: string): Promise<number> => {
    const res = await app.request(path, { method, headers: { 'x-real-ip': ip } })
    return res.status
  }
  // A fresh address per case. Reusing a spent one makes a limiter answer 429 from
  // memory, which passes a badly written test while proving nothing.
  const ip = (name: string): string => `203.0.113.${stamp % 200}-${name}`

  // Two assertions on one address, because the bucket is LARGER, not absent.
  // Only the second one fails under a pure exemption, and a sabotage run proved
  // that the three checks below all pass while media reads are unbounded.
  const mediaPath = `${HYPERMULTIMEDIA_MOUNT_PATH}/doc-1/pic.png`
  const mediaCap = max * MEDIA_READ_BUDGET_FACTOR
  let pastGlobal = 0
  let pastMedia = 0
  for (let i = 1; i <= mediaCap + 1; i += 1) {
    const status = await fire('GET', mediaPath, ip('media'))
    if (i === max + 5) pastGlobal = status
    if (i === mediaCap + 1) pastMedia = status
  }
  check(pastGlobal === 200, `media GET survives past the global ${max} (got ${pastGlobal})`)
  check(pastMedia === 429, `media GET is still bounded, at ${mediaCap} (got ${pastMedia})`)

  // Control one: the POST on the same prefix stays on the global budget.
  let uploadLast = 0
  for (let i = 0; i <= max; i += 1) {
    uploadLast = await fire('POST', `${HYPERMULTIMEDIA_MOUNT_PATH}/doc-1`, ip('upload'))
  }
  check(uploadLast === 429, `CONTROL upload POST is still limited at ${max} (got ${uploadLast})`)

  // Control two: an ordinary GET is not exempted, so the method check alone is
  // not what let the media reads through.
  let plainLast = 0
  for (let i = 0; i <= max; i += 1) {
    plainLast = await fire('GET', '/api/documents', ip('plain'))
  }
  check(plainLast === 429, `CONTROL ordinary GET is still limited at ${max} (got ${plainLast})`)

  // Every other section cleans up after itself; this one did not.
  await redis.del(`media-read:${ip('media')}`, `global:${ip('upload')}`, `global:${ip('plain')}`)
}

console.log('\n[4] Revert cooldown — one budget across two processes')
{
  const docId = `e2e-revert-${stamp}`
  const outcomes = await runChildren('revert', docId)
  const allowed = outcomes.filter((o) => o === 'allowed').length
  const refused = outcomes.filter((o) => o === 'refused').length
  check(allowed === 1, `exactly one process was allowed (got ${allowed}, ${outcomes.join(',')})`)
  check(refused === 1, `the other was refused by the shared budget (got ${refused})`)

  // Control: the per-process Map is what the change replaced. Both processes are
  // allowed, which is the fleet-wide hole this fix closes.
  const control = await runChildren('revert-local', `${docId}-control`)
  const controlAllowed = control.filter((o) => o === 'allowed').length
  check(controlAllowed === 2, `CONTROL per-process Map lets both through (got ${controlAllowed})`)

  await redis.del(`revert-cooldown:${docId}`, `revert-cooldown:${docId}-control`)
}

await disconnectRedis()
console.log(failed ? '\n✗ FAILED\n' : '\n✓ all checks passed\n')
process.exit(failed ? 1 : 0)
