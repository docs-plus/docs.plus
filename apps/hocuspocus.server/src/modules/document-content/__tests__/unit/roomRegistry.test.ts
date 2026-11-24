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

  const zremrangebyscore = (key: string, _min: string, max: string) => {
    const map = zsets.get(key)
    if (!map) return 0
    const exclusive = max.startsWith('(')
    const bound = Number(exclusive ? max.slice(1) : max)
    let removed = 0
    for (const [member, score] of map) {
      if (exclusive ? score < bound : score <= bound) {
        map.delete(member)
        removed += 1
      }
    }
    return removed
  }

  const zrevrange = (key: string) => {
    const map = zsets.get(key)
    if (!map) return []
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([member]) => member)
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
      zremrangebyscore(key: string, min: string, max: string) {
        ops.push(() => zremrangebyscore(key, min, max))
        return chain
      },
      zrevrange(key: string) {
        ops.push(() => zrevrange(key))
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
    expect(normalizeHost('[FE80::1]')).toBe('fe80::1')
    expect(isLoopbackHost('localhost')).toBe(true)
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(isLoopbackHost('[::1]')).toBe(true)
    expect(isLoopbackHost('172.18.0.5')).toBe(false)

    expect(isBlockedPeerIp('169.254.169.254')).toBe(true)
    expect(isBlockedPeerIp('0.0.0.0')).toBe(true)
    expect(isBlockedPeerIp('224.0.0.1')).toBe(true)
    expect(isBlockedPeerIp('255.255.255.255')).toBe(true)
    expect(isBlockedPeerIp('fe80::1')).toBe(true)
    expect(isBlockedPeerIp('ff02::1')).toBe(true)
    expect(isBlockedPeerIp('::')).toBe(true)
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

    // Advance past stale window for A while B heartbeats.
    clock += ROOM_OWNER_STALE_MS - 5_000
    await writerB.refreshMany([docId])
    expect(await reader.lookupOwners(docId)).toEqual(['http://172.18.0.6:4003'])

    await writerB.unregister(docId)
    expect(await reader.lookupOwners(docId)).toEqual([])
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
