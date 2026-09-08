/**
 * Real-infra E2E for document occupancy. It spawns itself as child processes,
 * because one process cannot prove a fleet-wide set. Needs real Redis and
 * REDIS_DB=15. Every check carries a control, because a check that still passes
 * with the feature absent proves nothing.
 */
import { config } from '../src/config/env'
import {
  OCCUPANCY_TTL_S,
  occupancyKey,
  occupancyMember,
  OCCUPANT_STALE_MS,
  readOccupantUserIds,
  releaseOccupant,
  touchOccupant
} from '../src/lib/documentOccupancy'
import { disconnectRedis, getRedisClient } from '../src/lib/redis'

// The child prints Redis logs on the same stream, so the parent reads the last
// marked line rather than the last line.
const RESULT_MARK = 'E2E_OCCUPANCY_RESULT '

if (config.redis.db === 0) {
  console.error('✗ Refusing to run on Redis database 0. Set REDIS_DB=15.')
  process.exit(1)
}

// Mixed case on purpose: the key takes the raw room name, so a lowercased key
// would read an empty set for this real document.
const DOC = 'Zrl8S6a5609d4ViFEf5'
const LOWER_DOC = DOC.toLowerCase()
const USER_A = '83bac16e-8ba7-4c1c-88c0-6e0a024b52c7'
const USER_B = '0f868b6c-cd9d-41ec-aff7-48f40f5efc38'

interface ChildPayload {
  outcome?: string
  userIds?: string[]
  lastOccupantGone?: boolean
  elapsedMs?: number
}

const childMode = process.env.E2E_OCCUPANCY_CHILD
if (childMode) {
  const doc = process.env.E2E_OCC_DOC ?? DOC
  const userId = process.env.E2E_OCC_USER ?? ''
  const at = Number(process.env.E2E_OCC_AT)
  const member = occupancyMember(userId, process.env.E2E_OCC_SOCKET ?? '')

  let payload: ChildPayload
  if (childMode === 'register') {
    payload = { outcome: await touchOccupant(doc, member, at, 'register') }
  } else if (childMode === 'release') {
    const released = await releaseOccupant(doc, userId, member, at)
    payload = { outcome: released.outcome, lastOccupantGone: released.lastOccupantGone }
  } else {
    const started = Date.now()
    const read = await readOccupantUserIds(doc, at)
    payload = { outcome: read.outcome, userIds: read.userIds, elapsedMs: Date.now() - started }
  }

  console.log(`${RESULT_MARK}${JSON.stringify(payload)}`)
  // No quit: the awaited reply already landed, and quitting a client aimed at a
  // Redis that never answers can block past the child's whole reason to exist.
  process.exit(0)
}

let failed = false
const check = (cond: boolean, msg: string): void => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failed = true
}

const createdKeys = new Set<string>()
const trackKey = (documentId: string): string => {
  const key = occupancyKey(documentId)
  createdKeys.add(key)
  return key
}

interface ChildArgs {
  doc: string
  user?: string
  socket?: string
  at: number
}

const runChild = async (
  mode: 'register' | 'release' | 'read',
  args: ChildArgs,
  envOverrides: Record<string, string> = {}
): Promise<{ payload: ChildPayload; exitCode: number }> => {
  const child = Bun.spawn([process.execPath, import.meta.path], {
    env: {
      ...process.env,
      E2E_OCCUPANCY_CHILD: mode,
      E2E_OCC_DOC: args.doc,
      E2E_OCC_USER: args.user ?? '',
      E2E_OCC_SOCKET: args.socket ?? '',
      E2E_OCC_AT: String(args.at),
      ...envOverrides
    },
    stdout: 'pipe',
    stderr: 'ignore'
  })
  const out = await new Response(child.stdout).text()
  const exitCode = await child.exited
  const line = out
    .split('\n')
    .filter((l) => l.startsWith(RESULT_MARK))
    .pop()
  // A child that died before printing must read as a broken harness, never as a
  // feature that answered `undefined`.
  if (!line) {
    check(false, `HARNESS a ${mode} child printed no result (exit ${exitCode})`)
    return { payload: {}, exitCode }
  }
  return { payload: JSON.parse(line.slice(RESULT_MARK.length)) as ChildPayload, exitCode }
}

const redis = getRedisClient()
if (!redis) {
  console.error('✗ Redis is required. Set REDIS_HOST and REDIS_PORT.')
  process.exit(1)
}

const stamp = Date.now()
console.log(`\ndocument ${DOC} · Redis database ${config.redis.db}`)

console.log('\n[1] The ghost — a socket that stopped being heard from')
{
  const key = trackKey(DOC)
  await redis.del(key)

  const registeredAt = Date.now()
  const member = occupancyMember(USER_A, `ghost-${stamp}`)
  await touchOccupant(DOC, member, registeredAt, 'register')

  const fresh = await readOccupantUserIds(DOC, registeredAt)
  check(fresh.userIds.includes(USER_A), 'CONTROL a just-registered occupant reads present')

  // The prune cutoff is `nowMs - OCCUPANT_STALE_MS`, so advancing the read
  // instant is exactly time passing, without adding 90 s to the run.
  const refreshedAt = registeredAt + OCCUPANT_STALE_MS + 1000
  await touchOccupant(DOC, member, refreshedAt, 'refresh')
  const refreshed = await readOccupantUserIds(DOC, refreshedAt)
  check(
    refreshed.userIds.includes(USER_A),
    'CONTROL a socket still being refreshed reads present past OCCUPANT_STALE_MS'
  )

  const goneAt = refreshedAt + OCCUPANT_STALE_MS + 1000
  const ghost = await readOccupantUserIds(DOC, goneAt)
  check(
    ghost.userIds.length === 0,
    `a ghost reports nobody present, so the fan-out notifies (got ${JSON.stringify(ghost.userIds)})`
  )
  check(ghost.outcome === 'empty', `the read names the empty arm (got ${ghost.outcome})`)
  check(
    (await redis.zcard(key)) === 0,
    'the ghost member was removed from the set, not merely filtered out of the reply'
  )
}

console.log('\n[2] Two processes, one room')
{
  const key = trackKey(DOC)
  const lowerKey = trackKey(LOWER_DOC)
  await redis.del(key, lowerKey)

  const now = Date.now()
  const before = await readOccupantUserIds(DOC, now)
  check(before.userIds.length === 0, 'CONTROL the room reads empty before any child runs')

  const registers = await Promise.all([
    runChild('register', { doc: DOC, user: USER_A, socket: `p1-${stamp}`, at: now }),
    runChild('register', { doc: DOC, user: USER_B, socket: `p2-${stamp}`, at: now }),
    // CONTROL for the mixed-case key: a third process writes the lowercased id.
    runChild('register', { doc: LOWER_DOC, user: USER_A, socket: `p3-${stamp}`, at: now })
  ])
  const registered = registers.filter((r) => r.payload.outcome === 'ok').length
  check(registered === 3, `all three children registered (got ${registered})`)

  const both = await readOccupantUserIds(DOC, now)
  const ids = [...both.userIds].sort()
  check(
    ids.length === 2 && ids.includes(USER_A) && ids.includes(USER_B),
    `the parent reads both children's users (got ${JSON.stringify(ids)})`
  )

  const lower = await readOccupantUserIds(LOWER_DOC, now)
  check(
    lower.userIds.length === 1 && lower.userIds[0] === USER_A,
    `CONTROL the lowercased documentId is a different room (got ${JSON.stringify(lower.userIds)})`
  )
}

console.log('\n[3] The two-tab rule — a different process registers and closes each tab')
{
  const key = trackKey(DOC)
  await redis.del(key)

  const now = Date.now()
  const tabOne = `tab1-${stamp}`
  const tabTwo = `tab2-${stamp}`
  await Promise.all([
    runChild('register', { doc: DOC, user: USER_A, socket: tabOne, at: now }),
    runChild('register', { doc: DOC, user: USER_A, socket: tabTwo, at: now })
  ])

  // Under a per-user member the second register would overwrite the first, and
  // the first close would then empty the room.
  check(
    (await redis.zcard(key)) === 2,
    `CONTROL two sockets of one person are two members (got ${await redis.zcard(key)})`
  )
  const oneUser = await readOccupantUserIds(DOC, now)
  check(
    oneUser.userIds.length === 1 && oneUser.userIds[0] === USER_A,
    `two tabs collapse to one occupant id (got ${JSON.stringify(oneUser.userIds)})`
  )

  // Neither closing process ever held the tab it closes, so the verdict can come
  // only from the shared set.
  const first = await runChild('release', { doc: DOC, user: USER_A, socket: tabOne, at: now })
  check(
    first.payload.lastOccupantGone === false,
    `closing the first tab does not report the person gone (got ${first.payload.lastOccupantGone})`
  )
  const still = await readOccupantUserIds(DOC, now)
  check(still.userIds.includes(USER_A), 'the person is still present after the first tab closes')

  const second = await runChild('release', { doc: DOC, user: USER_A, socket: tabTwo, at: now })
  check(
    second.payload.lastOccupantGone === true,
    `closing the second tab reports the person gone, which is what stamps Last left (got ${second.payload.lastOccupantGone})`
  )
  const gone = await readOccupantUserIds(DOC, now)
  check(gone.userIds.length === 0, 'the room is empty once both tabs have closed')
}

console.log('\n[4] Fail open — a Redis that cannot answer')
{
  const key = trackKey(DOC)
  await redis.del(key)

  const now = Date.now()
  await touchOccupant(DOC, occupancyMember(USER_A, `failopen-${stamp}`), now, 'register')

  const control = await runChild('read', { doc: DOC, at: now })
  check(
    control.payload.outcome === 'ok' && control.payload.userIds?.length === 1,
    `CONTROL the same child against the real Redis sees the occupant (got ${JSON.stringify(control.payload)})`
  )

  // A socket that accepts and never replies, so the child reaches a Redis it
  // cannot get an answer from. The OS picks the port, so nothing can collide.
  const blackHole = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => {} } })
  const hung = await runChild(
    'read',
    { doc: DOC, at: now },
    { REDIS_HOST: '127.0.0.1', REDIS_PORT: String(blackHole.port) }
  )
  blackHole.stop(true)
  check(
    hung.payload.userIds?.length === 0,
    `a hung Redis reports nobody present (got ${JSON.stringify(hung.payload.userIds)})`
  )
  check(hung.exitCode === 0, `the child returned rather than throwing (exit ${hung.exitCode})`)
  check(
    hung.payload.outcome === 'timeout',
    `the read names the timeout arm (got ${hung.payload.outcome})`
  )
  check(
    (hung.payload.elapsedMs ?? Infinity) < 2000,
    `the read is bounded (got ${hung.payload.elapsedMs} ms)`
  )

  const unset = await runChild('read', { doc: DOC, at: now }, { REDIS_HOST: '' })
  check(
    unset.payload.outcome === 'no-client' && unset.payload.userIds?.length === 0,
    `an unconfigured Redis reports nobody present (got ${JSON.stringify(unset.payload)})`
  )
}

console.log('\n[5] The key is bounded')
{
  const key = trackKey(DOC)
  await redis.del(key)

  const now = Date.now()
  const member = occupancyMember(USER_A, `ttl-${stamp}`)
  await touchOccupant(DOC, member, now, 'register')
  const ttl = await redis.ttl(key)
  check(
    ttl > 0 && ttl <= OCCUPANCY_TTL_S,
    `an occupied room carries a TTL (got ${ttl}, cap ${OCCUPANCY_TTL_S})`
  )

  // Control: without this, ttl() returning 3600 could just be how ttl() answers.
  const controlKey = `e2e-occupancy-no-expire-${stamp}`
  createdKeys.add(controlKey)
  await redis.zadd(controlKey, now, 'control-member')
  check(
    (await redis.ttl(controlKey)) === -1,
    `CONTROL a set written with no EXPIRE reports ttl -1 (got ${await redis.ttl(controlKey)})`
  )

  await redis.expire(key, 5)
  await touchOccupant(DOC, member, now + 1000, 'refresh')
  const rearmed = await redis.ttl(key)
  check(rearmed > 5, `every touch re-arms the TTL, so a busy room cannot expire (got ${rearmed})`)
}

console.log('\n[6] Cleanup')
{
  await redis.del(...createdKeys)
  let leftover = 0
  for (const key of createdKeys) leftover += await redis.exists(key)
  check(leftover === 0, `every key this run created is gone (got ${leftover} left)`)

  // KEYS is fine here: this is a scratch database, not production.
  const stray = await redis.keys('doc-occupancy:*')
  check(
    stray.length === 0,
    `no occupancy key is left in database ${config.redis.db} (got ${JSON.stringify(stray)})`
  )
}

await disconnectRedis()
console.log(failed ? '\n✗ FAILED\n' : '\n✓ all checks passed\n')
process.exit(failed ? 1 : 0)
