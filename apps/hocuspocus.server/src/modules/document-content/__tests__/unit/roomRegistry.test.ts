import { describe, expect, test } from 'bun:test'
import type os from 'node:os'
import type { Logger } from 'pino'

import type { RedisClient } from '../../../../types'
import {
  createPeerUrlValidator,
  createRoomRegistryReader,
  createRoomRegistryWriter,
  DNS_CACHE_TTL_MS,
  DNS_MISS_REFRESH_COOLDOWN_MS,
  isBlockedPeerIp,
  isLoopbackHost,
  normalizeHost,
  parseBareHttpOrigin,
  resolveAdvertiseUrl,
  ROOM_OWNER_KEY_TTL_S,
  ROOM_OWNER_STALE_MS,
  ROOM_REGISTRY_BATCH_CHUNK,
  roomOwnersKey
} from '../../infra/roomRegistry'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

/** Minimal in-memory ZSET fake for ioredis commands used by roomRegistry. */
const createFakeRedis = (opts?: { failNext?: Error; hangMs?: number }) => {
  const zsets = new Map<string, Map<string, number>>()
  const ttls = new Map<string, number>()
  let pipelineExecCount = 0

  const zadd = (key: string, score: number, member: string) => {
    let map = zsets.get(key)
    if (!map) {
      map = new Map()
      zsets.set(key, map)
    }
    map.set(member, score)
  }

  const zrem = (key: string, member: string) => {
    zsets.get(key)?.delete(member)
  }

  const zrevrangebyscore = (key: string, max: string, min: string) => {
    const map = zsets.get(key)
    if (!map) return []
    const minExclusive = min.startsWith('(')
    const minVal = min === '-inf' ? -Infinity : Number(minExclusive ? min.slice(1) : min)
    const maxExclusive = max.startsWith('(')
    const maxVal = max === '+inf' ? Infinity : Number(maxExclusive ? max.slice(1) : max)
    return [...map.entries()]
      .filter(([, score]) => {
        const aboveMin = minExclusive ? score > minVal : score >= minVal
        const belowMax = maxExclusive ? score < maxVal : score <= maxVal
        return aboveMin && belowMax
      })
      .sort((a, b) => b[1] - a[1])
      .map(([member]) => member)
  }

  const makeChain = (isPipeline: boolean) => {
    const ops: Array<() => unknown> = []
    const chain = {
      zadd(key: string, score: number, member: string) {
        ops.push(() => {
          zadd(key, score, member)
          return 1
        })
        return chain
      },
      expire(key: string, seconds: number) {
        ops.push(() => {
          ttls.set(key, seconds)
          return 1
        })
        return chain
      },
      zrem(key: string, member: string) {
        ops.push(() => {
          zrem(key, member)
          return 1
        })
        return chain
      },
      async exec() {
        if (isPipeline) pipelineExecCount += 1
        if (opts?.hangMs) await new Promise((r) => setTimeout(r, opts.hangMs))
        if (opts?.failNext) throw opts.failNext
        return ops.map((fn) => [null, fn()] as [Error | null, unknown])
      }
    }
    return chain
  }

  const client = {
    multi: () => makeChain(false),
    pipeline: () => makeChain(true),
    zrevrangebyscore: async (key: string, max: string, min: string) => {
      if (opts?.hangMs) await new Promise((r) => setTimeout(r, opts.hangMs))
      if (opts?.failNext) throw opts.failNext
      return zrevrangebyscore(key, max, min)
    },
    zrem: async (key: string, member: string) => {
      if (opts?.hangMs) await new Promise((r) => setTimeout(r, opts.hangMs))
      if (opts?.failNext) throw opts.failNext
      zrem(key, member)
      return 1
    }
  } as unknown as RedisClient

  return {
    client,
    zsets,
    ttls,
    getPipelineExecCount: () => pipelineExecCount
  }
}

describe('roomRegistry — pure URL, IP, and advertise resolution', () => {
  test('parseBareHttpOrigin accepts bare http(s) origins and rejects path, query, credentials, or non-http', () => {
    expect(parseBareHttpOrigin('http://172.18.0.5:4003')).toEqual({
      origin: 'http://172.18.0.5:4003',
      protocol: 'http:',
      host: '172.18.0.5',
      port: 4003
    })
    expect(parseBareHttpOrigin('https://hocuspocus-server/')).toEqual({
      origin: 'https://hocuspocus-server',
      protocol: 'https:',
      host: 'hocuspocus-server',
      port: 443
    })
    for (const bad of [
      'http://172.18.0.5:4003/internal',
      'http://172.18.0.5:4003?x=1',
      'http://172.18.0.5:4003#frag',
      'http://user:pass@172.18.0.5:4003',
      'file:///etc/passwd',
      'gopher://127.0.0.1:6379',
      'not-a-url'
    ]) {
      expect(parseBareHttpOrigin(bad)).toBeNull()
    }
  })

  test('normalizeHost, isLoopbackHost, and isBlockedPeerIp classify addresses defensively', () => {
    expect(normalizeHost('[::ffff:172.18.0.5]')).toBe('172.18.0.5')
    expect(normalizeHost('::ffff:a9fe:a9fe')).toBe('169.254.169.254')
    expect(normalizeHost('::ffff:7f00:1')).toBe('127.0.0.1')
    expect(normalizeHost('[0::0]')).toBe('::')
    expect(normalizeHost('[0:0:0:0:0:0:0:1]')).toBe('::1')
    expect(normalizeHost('[FE80::1]')).toBe('fe80::1')
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('[::1]')).toBe(true)
    expect(isLoopbackHost('[::ffff:127.0.0.1]')).toBe(true)
    expect(isLoopbackHost('::ffff:7f00:1')).toBe(true)
    expect(isLoopbackHost('172.18.0.5')).toBe(false)

    expect(isBlockedPeerIp('169.254.169.254')).toBe(true)
    expect(isBlockedPeerIp('[::ffff:169.254.169.254]')).toBe(true)
    expect(isBlockedPeerIp('::ffff:a9fe:a9fe')).toBe(true)
    expect(isBlockedPeerIp('0.0.0.0')).toBe(true)
    expect(isBlockedPeerIp('224.0.0.1')).toBe(true)
    expect(isBlockedPeerIp('255.255.255.255')).toBe(true)
    expect(isBlockedPeerIp('fe80::1')).toBe(true)
    expect(isBlockedPeerIp('fe80::1%eth0')).toBe(true)
    expect(isBlockedPeerIp('ff02::1')).toBe(true)
    expect(isBlockedPeerIp('::')).toBe(true)
    expect(isBlockedPeerIp('0::0')).toBe(true)
    expect(isBlockedPeerIp('172.18.0.5')).toBe(false)
    expect(isBlockedPeerIp('10.244.1.7')).toBe(false)
  })

  test('resolveAdvertiseUrl prefers explicit URL, then concrete bind host, then non-internal IPv4', () => {
    expect(
      resolveAdvertiseUrl({
        explicitUrl: 'http://10.0.0.8:4003/',
        bindHost: '0.0.0.0',
        bindPort: 4003
      })
    ).toBe('http://10.0.0.8:4003')

    expect(
      resolveAdvertiseUrl({
        bindHost: '127.0.0.1',
        bindPort: 41234
      })
    ).toBe('http://127.0.0.1:41234')

    expect(() =>
      resolveAdvertiseUrl({
        bindHost: 'bad host/path',
        bindPort: 4003
      })
    ).toThrow('Invalid bindHost/bindPort')

    const mockIfaces = (): NodeJS.Dict<os.NetworkInterfaceInfo[]> => ({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as os.NetworkInterfaceInfo],
      linklocal: [
        { address: '169.254.1.1', family: 'IPv4', internal: false } as os.NetworkInterfaceInfo
      ],
      eth0: [{ address: '172.18.0.5', family: 'IPv4', internal: false } as os.NetworkInterfaceInfo]
    })
    expect(
      resolveAdvertiseUrl({
        bindHost: '0.0.0.0',
        bindPort: 4003,
        networkInterfaces: mockIfaces
      })
    ).toBe('http://172.18.0.5:4003')
    expect(
      resolveAdvertiseUrl({
        bindHost: '[0::0]',
        bindPort: 4003,
        networkInterfaces: mockIfaces
      })
    ).toBe('http://172.18.0.5:4003')
  })
})

describe('createPeerUrlValidator — SSRF allowlist & zero-overhead single-replica bypass', () => {
  test('loopback baseUrl with no explicit peers disables routing with zero DNS lookups', async () => {
    let dnsCalls = 0
    const validator = createPeerUrlValidator({
      baseUrl: 'http://localhost:4003',
      dnsLookup: async () => {
        dnsCalls += 1
        return ['127.0.0.1']
      },
      logger: silentLogger
    })

    expect(await validator.isRoutingActive()).toBe(false)
    expect(await validator.validate('http://127.0.0.1:4003')).toBeNull()
    expect(dnsCalls).toBe(0)
  })

  test('single-IP service DNS (1 replica or 1-IP VIP) disables routing to skip Redis', async () => {
    const validator = createPeerUrlValidator({
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async () => ['172.18.0.5'],
      logger: silentLogger
    })

    expect(await validator.isRoutingActive()).toBe(false)
  })

  test('multi-A DNS mode enforces scheme, port, literal IP, and DNS membership with rate-limited miss refresh', async () => {
    let clock = 10_000
    let dnsCalls = 0
    let currentIps = ['172.18.0.5', '172.18.0.6']

    const validator = createPeerUrlValidator({
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async (host) => {
        expect(host).toBe('hocuspocus-server')
        dnsCalls += 1
        return currentIps
      },
      now: () => clock,
      logger: silentLogger
    })

    expect(await validator.isRoutingActive()).toBe(true)
    expect(await validator.validate('http://172.18.0.5:4003')).toBe('http://172.18.0.5:4003')
    expect(await validator.validate('http://172.18.0.6:4003')).toBe('http://172.18.0.6:4003')
    expect(dnsCalls).toBe(1)

    // Rejects every SSRF vector without ever resolving an attacker hostname.
    for (const attack of [
      'http://169.254.169.254:4003',
      'http://[::ffff:169.254.169.254]:4003', // IPv4-mapped metadata (WHATWG hex-grouped)
      'http://[::ffff:127.0.0.1]:4003', // IPv4-mapped loopback
      'http://[0::0]:4003', // non-canonical unspecified IPv6
      'http://172.18.0.2:4003', // different container on same Docker subnet
      'http://172.18.0.5:6379', // wrong port
      'https://172.18.0.5:4003', // wrong scheme
      'http://evil.example:4003', // arbitrary hostname
      'http://172.18.0.5:4003/evil', // path smuggling
      'http://user:pass@172.18.0.5:4003' // credentials
    ]) {
      expect(await validator.validate(attack)).toBeNull()
    }
    // Only 1 forced miss refresh fired within the cooldown window despite multiple rejected IPs.
    expect(dnsCalls).toBe(2)

    // Rolling-deploy scale-up: a new replica IP joins after cooldown and is accepted on miss refresh.
    clock += DNS_MISS_REFRESH_COOLDOWN_MS + 100
    currentIps = ['172.18.0.5', '172.18.0.9']
    expect(await validator.validate('http://172.18.0.9:4003')).toBe('http://172.18.0.9:4003')
    expect(dnsCalls).toBe(3)

    // After TTL expires, retired replica IP is dropped on cache refresh.
    clock += DNS_CACHE_TTL_MS + 100
    expect(await validator.validate('http://172.18.0.6:4003')).toBeNull()
  })

  test('coalesces concurrent DNS lookups via single-flight', async () => {
    let dnsCalls = 0
    const validator = createPeerUrlValidator({
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async () => {
        dnsCalls += 1
        await new Promise((r) => setTimeout(r, 15))
        return ['172.18.0.5', '172.18.0.6']
      },
      logger: silentLogger
    })

    const results = await Promise.all([
      validator.validate('http://172.18.0.5:4003'),
      validator.validate('http://172.18.0.6:4003'),
      validator.isRoutingActive()
    ])
    expect(results).toEqual(['http://172.18.0.5:4003', 'http://172.18.0.6:4003', true])
    expect(dnsCalls).toBe(1)
  })

  test('explicit allowedPeerUrls mode permits only listed origins and rejects all others', async () => {
    const validator = createPeerUrlValidator({
      baseUrl: 'http://127.0.0.1:41002',
      allowedPeerUrls: ['http://127.0.0.1:41001/', 'http://127.0.0.1:41002'],
      logger: silentLogger
    })

    expect(await validator.isRoutingActive()).toBe(true)
    expect(await validator.validate('http://127.0.0.1:41001')).toBe('http://127.0.0.1:41001')
    expect(await validator.validate('http://127.0.0.1:41003')).toBeNull()
    expect(await validator.validate('http://169.254.169.254:41001')).toBeNull()
  })

  test('backs off failed and timed-out DNS lookups for DNS_MISS_REFRESH_COOLDOWN_MS', async () => {
    let clock = 10_000
    let dnsCalls = 0
    let shouldFail = true

    const validator = createPeerUrlValidator({
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async () => {
        dnsCalls += 1
        if (shouldFail) throw new Error('EAI_AGAIN')
        return ['172.18.0.5', '172.18.0.6']
      },
      now: () => clock,
      logger: silentLogger
    })

    expect(await validator.isRoutingActive()).toBe(false)
    expect(await validator.isRoutingActive()).toBe(false)
    expect(await validator.validate('http://172.18.0.5:4003')).toBeNull()
    expect(dnsCalls).toBe(1)

    // After cooldown expires, DNS is retried and recovers.
    clock += DNS_MISS_REFRESH_COOLDOWN_MS + 1
    shouldFail = false
    expect(await validator.isRoutingActive()).toBe(true)
    expect(dnsCalls).toBe(2)

    // A hung DNS lookup respects ROOM_REGISTRY_OP_TIMEOUT_MS and also backs off.
    let slowClock = 20_000
    let slowCalls = 0
    const slowValidator = createPeerUrlValidator({
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async () => {
        slowCalls += 1
        await new Promise((r) => setTimeout(r, 500))
        return ['172.18.0.5', '172.18.0.6']
      },
      now: () => slowClock,
      logger: silentLogger
    })

    const started = Date.now()
    expect(await slowValidator.isRoutingActive()).toBe(false)
    expect(Date.now() - started).toBeLessThan(400)
    expect(await slowValidator.isRoutingActive()).toBe(false)
    expect(slowCalls).toBe(1)
    slowClock += DNS_MISS_REFRESH_COOLDOWN_MS + 1
    expect(await slowValidator.isRoutingActive()).toBe(false)
    expect(slowCalls).toBe(2)
  })
})

describe('roomRegistry writer & reader — ZSET lifecycle, staleness, chunking, and fail-open', () => {
  test('registers case-sensitive keys with TTL, returns newest-first, prunes stale owners, and unregisters', async () => {
    const fake = createFakeRedis()
    let clock = 1_000_000
    const docId = 'MixedCaseDoc12345AB'

    const writerA = createRoomRegistryWriter({
      redis: fake.client,
      advertiseUrl: 'http://172.18.0.5:4003',
      logger: silentLogger,
      now: () => clock
    })
    const writerB = createRoomRegistryWriter({
      redis: fake.client,
      advertiseUrl: 'http://172.18.0.6:4003',
      logger: silentLogger,
      now: () => clock
    })
    const reader = createRoomRegistryReader({
      redis: fake.client,
      baseUrl: 'http://hocuspocus-server:4003',
      dnsLookup: async () => ['172.18.0.5', '172.18.0.6'],
      logger: silentLogger,
      now: () => clock
    })

    await writerA.register(docId)
    expect(fake.ttls.get(roomOwnersKey(docId))).toBe(ROOM_OWNER_KEY_TTL_S)

    // Inject a poisoned entry directly in Redis — reader must drop it.
    fake.zsets.get(roomOwnersKey(docId))?.set('http://169.254.169.254:4003', clock + 500)

    clock += 10_000
    await writerB.register(docId)
    expect(await reader.lookupOwners(docId)).toEqual([
      'http://172.18.0.6:4003',
      'http://172.18.0.5:4003'
    ])

    // Advance past stale window for A while B heartbeats (read path does not mutate Redis).
    clock += ROOM_OWNER_STALE_MS - 5_000
    await writerB.refreshMany([docId])
    expect(await reader.lookupOwners(docId)).toEqual(['http://172.18.0.6:4003'])
    expect(fake.zsets.get(roomOwnersKey(docId))?.has('http://172.18.0.5:4003')).toBe(true)

    await writerB.unregister(docId)
    expect(await reader.lookupOwners(docId)).toEqual([])
  })

  test('unregister during in-flight refreshMany or register does not leave stale owner in Redis', async () => {
    const zsets = new Map<string, Map<string, number>>()
    let releaseSlowFlush!: () => void
    let delayNextExec = false

    const client = {
      multi: () => {
        const ops: Array<() => void> = []
        return {
          zadd(key: string, score: number, member: string) {
            ops.push(() => {
              let m = zsets.get(key)
              if (!m) {
                m = new Map()
                zsets.set(key, m)
              }
              m.set(member, score)
            })
            return this
          },
          expire() {
            return this
          },
          async exec() {
            if (delayNextExec) {
              delayNextExec = false
              await new Promise<void>((resolve) => {
                releaseSlowFlush = resolve
              })
            }
            for (const op of ops) op()
            return ops.map(() => [null, 1])
          }
        }
      },
      pipeline: () => {
        const ops: Array<() => void> = []
        return {
          zadd(key: string, score: number, member: string) {
            ops.push(() => {
              let m = zsets.get(key)
              if (!m) {
                m = new Map()
                zsets.set(key, m)
              }
              m.set(member, score)
            })
            return this
          },
          expire() {
            return this
          },
          zrem(key: string, member: string) {
            ops.push(() => {
              zsets.get(key)?.delete(member)
            })
            return this
          },
          async exec() {
            if (delayNextExec) {
              delayNextExec = false
              await new Promise<void>((resolve) => {
                releaseSlowFlush = resolve
              })
            }
            for (const op of ops) op()
            return ops.map(() => [null, 1])
          }
        }
      },
      zrem: async (key: string, member: string) => {
        zsets.get(key)?.delete(member)
        return 1
      }
    } as unknown as RedisClient

    const writer = createRoomRegistryWriter({
      redis: client,
      advertiseUrl: 'http://172.18.0.5:4003',
      logger: silentLogger
    })

    // Case 1: in-flight refreshMany races with unregister.
    delayNextExec = true
    const flushing = writer.refreshMany(['doc-race-1'])
    await writer.unregister('doc-race-1')
    releaseSlowFlush()
    await flushing
    expect(zsets.get(roomOwnersKey('doc-race-1'))?.size ?? 0).toBe(0)

    // Case 2: in-flight register races with unregister.
    delayNextExec = true
    const registering = writer.register('doc-race-2')
    await writer.unregister('doc-race-2')
    releaseSlowFlush()
    await registering
    expect(zsets.get(roomOwnersKey('doc-race-2'))?.size ?? 0).toBe(0)
  })

  test('refreshMany and unregisterMany chunk large room sets and skip empty lists', async () => {
    const fake = createFakeRedis()
    const writer = createRoomRegistryWriter({
      redis: fake.client,
      advertiseUrl: 'http://172.18.0.5:4003',
      logger: silentLogger
    })

    await writer.refreshMany([])
    await writer.unregisterMany([])
    expect(fake.getPipelineExecCount()).toBe(0)

    const docs = Array.from({ length: ROOM_REGISTRY_BATCH_CHUNK + 5 }, (_, i) => `doc-${i}`)
    await writer.refreshMany(docs)
    expect(fake.getPipelineExecCount()).toBe(2)

    await writer.unregisterMany(docs)
    expect(fake.getPipelineExecCount()).toBe(4)
    expect(fake.zsets.get(roomOwnersKey('doc-0'))?.size).toBe(0)
  })

  test('fails open to [] when Redis errors or exceeds the op timeout budget', async () => {
    const failing = createFakeRedis({ failNext: new Error('ECONNREFUSED') })
    const readerErr = createRoomRegistryReader({
      redis: failing.client,
      baseUrl: 'http://127.0.0.1:41002',
      allowedPeerUrls: ['http://127.0.0.1:41001', 'http://127.0.0.1:41002'],
      logger: silentLogger
    })
    expect(await readerErr.lookupOwners('doc-1')).toEqual([])

    const hanging = createFakeRedis({ hangMs: 500 })
    const readerSlow = createRoomRegistryReader({
      redis: hanging.client,
      baseUrl: 'http://127.0.0.1:41002',
      allowedPeerUrls: ['http://127.0.0.1:41001', 'http://127.0.0.1:41002'],
      logger: silentLogger
    })
    const started = Date.now()
    expect(await readerSlow.lookupOwners('doc-1')).toEqual([])
    expect(Date.now() - started).toBeLessThan(400)
  })
})
