/**
 * Multi-replica room-owner registry backed by Redis sorted sets (#816).
 *
 * Each collaboration replica registers its internal HTTP origin in
 * `ws:room-owners:<documentId>` on `afterLoadDocument`, heartbeats every 30 s,
 * and removes itself on `afterUnloadDocument` and shutdown. REST's
 * `contentClient` reads this set, strictly validates every peer URL against an
 * SSRF allowlist before dialing, and degrades with zero extra latency in
 * single-replica dev, 1-IP VIP, and Redis-unavailable deployments.
 *
 * Imports types only from Redis — no module-scope sockets or side effects.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import os from 'node:os'

import type { Logger } from 'pino'

import {
  expandIpv6,
  normalizeHost,
  parseBareHttpOrigin,
  type ParsedOrigin
} from '../../../lib/httpOrigin'
import { createSingleFlight } from '../../../lib/singleFlight'
import { TIMED_OUT, withinTimeout } from '../../../lib/withinTimeout'
import type { RedisClient } from '../../../types'
import type { RoomRegistryReader, RoomRegistryWriter } from '../types'

export { normalizeHost, parseBareHttpOrigin, type ParsedOrigin }

/** Key prefix; takes the raw case-sensitive `documentId`. */
export const ROOM_OWNER_KEY_PREFIX = 'ws:room-owners:'

/** Collab replica heartbeat cadence for loaded rooms. */
export const ROOM_OWNER_HEARTBEAT_MS = 30_000

/** Tolerates two missed heartbeats before pruning a dead replica's membership. */
export const ROOM_OWNER_STALE_MS = 90_000

/** Key TTL refreshed on every register/heartbeat so crashed replicas never leak keys. */
export const ROOM_OWNER_KEY_TTL_S = 180

/** Single Redis op budget — REDIS_COMMAND_TIMEOUT is 60 s and enableOfflineQueue is true. */
export const ROOM_REGISTRY_OP_TIMEOUT_MS = 150

/** Batch heartbeat / shutdown pipeline budget per chunk. */
export const ROOM_REGISTRY_BATCH_TIMEOUT_MS = 1_000

/** Pipeline chunk size (mirrors CLAUDE.md's chunked-pipeline rule). */
export const ROOM_REGISTRY_BATCH_CHUNK = 200

/** Cached multi-A DNS allowlist TTL for `HOCUSPOCUS_INTERNAL_URL`. */
export const DNS_CACHE_TTL_MS = 10_000

/** Minimum interval between forced DNS refreshes on allowlist miss (stops amplification). */
export const DNS_MISS_REFRESH_COOLDOWN_MS = 2_000

export type DnsIpLookup = (hostname: string) => Promise<string[]>

/** Raw case-sensitive room-owner ZSET key. */
export const roomOwnersKey = (documentId: string): string => `${ROOM_OWNER_KEY_PREFIX}${documentId}`

export const isLoopbackHost = (host: string): boolean => {
  const normalized = normalizeHost(host)
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.')
}

/**
 * Blocks non-routable / metadata / multicast IP literals defensively, even if DNS
 * or an interface list ever reported one.
 */
export const isBlockedPeerIp = (host: string): boolean => {
  const ip = normalizeHost(host)
  const family = isIP(ip)
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0) return true // 0.0.0.0/8 unspecified
    if (a === 169 && b === 254) return true // 169.254.0.0/16 cloud metadata / link-local
    if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved/broadcast
    return false
  }
  if (family === 6) {
    const groups = expandIpv6(ip)
    if (!groups) return true
    if (groups.every((g) => g === 0)) return true // :: / 0::0 unspecified
    if ((groups[0]! & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
    if ((groups[0]! & 0xff00) === 0xff00) return true // ff00::/8 multicast
    return false
  }
  return false
}

const formatHostForUrl = (host: string): string => {
  const trimmed = host.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed
  return trimmed.includes(':') ? `[${trimmed}]` : trimmed
}

export interface ResolveAdvertiseUrlOptions {
  explicitUrl?: string | null
  bindHost: string
  bindPort: number
  networkInterfaces?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>
}

/**
 * Resolves the canonical internal origin a collab replica advertises in Redis.
 * Explicit env wins; a concrete bind host (e.g. `127.0.0.1` in local probes) is
 * used directly; wildcard `0.0.0.0`/`::` auto-selects the container's first
 * non-internal, non-link-local IPv4 (`eth0` on `docsplus-network`).
 */
export const resolveAdvertiseUrl = ({
  explicitUrl,
  bindHost,
  bindPort,
  networkInterfaces = os.networkInterfaces
}: ResolveAdvertiseUrlOptions): string => {
  if (explicitUrl) {
    const parsed = parseBareHttpOrigin(explicitUrl)
    if (!parsed) throw new Error(`Invalid advertise URL: ${explicitUrl}`)
    return parsed.origin
  }

  const trimmedBind = bindHost.trim()
  const isWildcard =
    trimmedBind === '' || trimmedBind === '0.0.0.0' || normalizeHost(trimmedBind) === '::'
  if (!isWildcard) {
    const candidate = `http://${formatHostForUrl(trimmedBind)}:${bindPort}`
    const parsed = parseBareHttpOrigin(candidate)
    if (!parsed) throw new Error(`Invalid bindHost/bindPort for advertise URL: ${candidate}`)
    return parsed.origin
  }

  const interfaces = networkInterfaces()
  const all = Object.values(interfaces).flatMap((entries) => entries ?? [])
  const ipv4 = all.find(
    (entry) =>
      entry.family === 'IPv4' &&
      !entry.internal &&
      !isLoopbackHost(entry.address) &&
      !isBlockedPeerIp(entry.address)
  )
  if (ipv4) return `http://${ipv4.address}:${bindPort}`

  const ipv6 = all.find(
    (entry) =>
      entry.family === 'IPv6' &&
      !entry.internal &&
      !isLoopbackHost(entry.address) &&
      !isBlockedPeerIp(entry.address)
  )
  if (ipv6) return `http://${formatHostForUrl(ipv6.address)}:${bindPort}`

  return `http://127.0.0.1:${bindPort}`
}

const defaultDnsLookup: DnsIpLookup = async (hostname) => {
  const records = await lookup(hostname, { all: true })
  return records.map((record) => normalizeHost(record.address))
}

const throwOnReplyError = (replies: [Error | null, unknown][] | null): void => {
  for (const [err] of replies ?? []) if (err) throw err
}

const withinBudget = async <T>(
  op: string,
  timeoutMs: number,
  logger: Logger,
  run: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false }> => {
  try {
    const raced = await withinTimeout(run(), timeoutMs)
    if (raced === TIMED_OUT) {
      logger.warn({ op, timeoutMs }, 'Room registry Redis call timed out')
      return { ok: false }
    }
    return { ok: true, value: raced }
  } catch (err) {
    logger.warn({ err, op }, 'Room registry Redis call failed')
    return { ok: false }
  }
}

export interface RoomRegistryWriterDeps {
  redis: RedisClient | null
  advertiseUrl: string
  logger: Logger
  now?: () => number
}

/** Collab-side writer: registers, heartbeats, and removes this replica's loaded rooms. */
export const createRoomRegistryWriter = (deps: RoomRegistryWriterDeps): RoomRegistryWriter => {
  const { redis, advertiseUrl, logger } = deps
  const now = deps.now ?? Date.now
  const inactiveDocs = new Set<string>()
  const inFlight = new Map<string, number>()

  const enterFlight = (documentId: string): void => {
    inFlight.set(documentId, (inFlight.get(documentId) ?? 0) + 1)
  }

  const leaveFlight = (documentId: string): void => {
    const remaining = (inFlight.get(documentId) ?? 1) - 1
    if (remaining <= 0) {
      inFlight.delete(documentId)
      inactiveDocs.delete(documentId)
    } else {
      inFlight.set(documentId, remaining)
    }
  }

  const removeCompensating = async (documentIds: string[]): Promise<void> => {
    if (!redis || documentIds.length === 0) return
    await withinBudget('unregister-stale', ROOM_REGISTRY_OP_TIMEOUT_MS, logger, async () => {
      if (documentIds.length === 1) {
        await redis.zrem(roomOwnersKey(documentIds[0]!), advertiseUrl)
        return
      }
      const pipe = redis.pipeline()
      for (const id of documentIds) pipe.zrem(roomOwnersKey(id), advertiseUrl)
      const replies = await pipe.exec()
      throwOnReplyError(replies)
    })
  }

  const register: RoomRegistryWriter['register'] = async (documentId) => {
    if (!redis) return
    inactiveDocs.delete(documentId)
    enterFlight(documentId)
    const key = roomOwnersKey(documentId)
    try {
      await withinBudget('register', ROOM_REGISTRY_OP_TIMEOUT_MS, logger, async () => {
        const replies = await redis
          .multi()
          .zadd(key, now(), advertiseUrl)
          .expire(key, ROOM_OWNER_KEY_TTL_S)
          .exec()
        throwOnReplyError(replies)
      })
      if (inactiveDocs.has(documentId)) {
        await removeCompensating([documentId])
      }
    } finally {
      leaveFlight(documentId)
    }
  }

  const unregister: RoomRegistryWriter['unregister'] = async (documentId) => {
    if (!redis) return
    inactiveDocs.add(documentId)
    enterFlight(documentId)
    const key = roomOwnersKey(documentId)
    try {
      await withinBudget('unregister', ROOM_REGISTRY_OP_TIMEOUT_MS, logger, async () => {
        await redis.zrem(key, advertiseUrl)
      })
    } finally {
      leaveFlight(documentId)
    }
  }

  const refreshMany: RoomRegistryWriter['refreshMany'] = async (documentIds) => {
    if (!redis || documentIds.length === 0) return
    const eligible = documentIds.filter((id) => !inactiveDocs.has(id))
    if (eligible.length === 0) return
    for (const id of eligible) enterFlight(id)
    const ts = now()
    try {
      for (let i = 0; i < eligible.length; i += ROOM_REGISTRY_BATCH_CHUNK) {
        const chunk = eligible.slice(i, i + ROOM_REGISTRY_BATCH_CHUNK)
        await withinBudget('heartbeat', ROOM_REGISTRY_BATCH_TIMEOUT_MS, logger, async () => {
          const pipe = redis.pipeline()
          for (const documentId of chunk) {
            const key = roomOwnersKey(documentId)
            pipe.zadd(key, ts, advertiseUrl).expire(key, ROOM_OWNER_KEY_TTL_S)
          }
          const replies = await pipe.exec()
          throwOnReplyError(replies)
        })
        const unloadedDuringFlush = chunk.filter((id) => inactiveDocs.has(id))
        if (unloadedDuringFlush.length > 0) {
          await removeCompensating(unloadedDuringFlush)
        }
      }
    } finally {
      for (const id of eligible) leaveFlight(id)
    }
  }

  const unregisterMany: RoomRegistryWriter['unregisterMany'] = async (documentIds) => {
    if (!redis || documentIds.length === 0) return
    for (const id of documentIds) {
      inactiveDocs.add(id)
      enterFlight(id)
    }
    try {
      for (let i = 0; i < documentIds.length; i += ROOM_REGISTRY_BATCH_CHUNK) {
        const chunk = documentIds.slice(i, i + ROOM_REGISTRY_BATCH_CHUNK)
        await withinBudget(
          'shutdown-unregister',
          ROOM_REGISTRY_BATCH_TIMEOUT_MS,
          logger,
          async () => {
            const pipe = redis.pipeline()
            for (const documentId of chunk) {
              pipe.zrem(roomOwnersKey(documentId), advertiseUrl)
            }
            const replies = await pipe.exec()
            throwOnReplyError(replies)
          }
        )
      }
    } finally {
      for (const id of documentIds) leaveFlight(id)
    }
  }

  return { register, unregister, refreshMany, unregisterMany }
}

export interface PeerUrlValidatorDeps {
  baseUrl: string
  allowedPeerUrls?: readonly string[]
  dnsLookup?: DnsIpLookup
  logger: Logger
  now?: () => number
}

export interface PeerUrlValidator {
  /** False for single-replica loopback dev and 1-IP VIPs — skips Redis completely. */
  isRoutingActive: () => Promise<boolean>
  /** Returns canonical `origin` if SSRF-safe and allowlisted, else `null`. */
  validate: (rawUrl: string) => Promise<string | null>
}

/**
 * Strictly validates peer URLs read from Redis so untrusted or poisoned entries
 * can never redirect internal service-role requests off the collab fleet.
 */
export const createPeerUrlValidator = (deps: PeerUrlValidatorDeps): PeerUrlValidator => {
  const { logger } = deps
  const now = deps.now ?? Date.now
  const dnsLookup = deps.dnsLookup ?? defaultDnsLookup
  const base = parseBareHttpOrigin(deps.baseUrl)

  // Mode A: Explicit peer allowlist (local multi-port probes, static K8s peers).
  if (deps.allowedPeerUrls && deps.allowedPeerUrls.length > 0) {
    const allowedOrigins = new Set<string>()
    for (const entry of deps.allowedPeerUrls) {
      const parsed = parseBareHttpOrigin(entry)
      if (parsed) allowedOrigins.add(parsed.origin)
      else logger.warn({ entry }, 'Ignoring invalid entry in allowedPeerUrls')
    }

    return {
      isRoutingActive: async () => allowedOrigins.size > 0,
      validate: async (rawUrl) => {
        const parsed = parseBareHttpOrigin(rawUrl)
        if (!parsed || !allowedOrigins.has(parsed.origin)) {
          logger.warn({ peerUrl: rawUrl }, 'Rejected peer URL outside explicit allowlist')
          return null
        }
        return parsed.origin
      }
    }
  }

  // Mode B: Unparseable baseUrl or loopback dev (localhost / 127.0.0.1 / ::1) → single replica.
  if (!base || isLoopbackHost(base.host) || isIP(base.host) !== 0) {
    return {
      isRoutingActive: async () => false,
      validate: async () => null
    }
  }

  // Mode C: Service hostname (e.g. `http://hocuspocus-server:4003`) → DNS multi-A allowlist.
  const dnsFlight = createSingleFlight<Set<string>>()
  let cachedIps: Set<string> | null = null
  let fetchedAt = 0
  let lastMissRefreshAt = 0
  let lastFailureAt: number | null = null

  const resolveAllowedIps = async (forceOnMiss: boolean): Promise<Set<string>> => {
    const current = now()
    if (cachedIps !== null && !forceOnMiss && current - fetchedAt < DNS_CACHE_TTL_MS) {
      return cachedIps
    }
    if (lastFailureAt !== null && current - lastFailureAt < DNS_MISS_REFRESH_COOLDOWN_MS) {
      return cachedIps ?? new Set()
    }
    if (forceOnMiss && current - lastMissRefreshAt < DNS_MISS_REFRESH_COOLDOWN_MS) {
      return cachedIps ?? new Set()
    }
    if (forceOnMiss) lastMissRefreshAt = current

    return dnsFlight(base.host, async () => {
      try {
        const ips = await withinTimeout(dnsLookup(base.host), ROOM_REGISTRY_OP_TIMEOUT_MS)
        if (ips === TIMED_OUT) {
          lastFailureAt = now()
          logger.warn(
            { host: base.host, timeoutMs: ROOM_REGISTRY_OP_TIMEOUT_MS },
            'DNS lookup for collab peer allowlist timed out'
          )
          return cachedIps ?? new Set()
        }
        const next = new Set<string>()
        for (const ip of ips) {
          const normalized = normalizeHost(ip)
          if (
            isIP(normalized) !== 0 &&
            !isLoopbackHost(normalized) &&
            !isBlockedPeerIp(normalized)
          ) {
            next.add(normalized)
          }
        }
        cachedIps = next
        fetchedAt = now()
        lastFailureAt = null
        return next
      } catch (err) {
        lastFailureAt = now()
        logger.warn({ err, host: base.host }, 'DNS lookup for collab peer allowlist failed')
        return cachedIps ?? new Set()
      }
    })
  }

  return {
    isRoutingActive: async () => {
      const ips = await resolveAllowedIps(false)
      // Single-replica Docker or 1-IP VIP: only one destination exists, so skip Redis.
      return ips.size > 1
    },
    validate: async (rawUrl) => {
      const parsed = parseBareHttpOrigin(rawUrl)
      if (!parsed) {
        logger.warn({ peerUrl: rawUrl }, 'Rejected malformed peer URL from room registry')
        return null
      }
      if (parsed.protocol !== base.protocol || parsed.port !== base.port) {
        logger.warn(
          { peerUrl: rawUrl, expectedProtocol: base.protocol, expectedPort: base.port },
          'Rejected peer URL with mismatched scheme or port'
        )
        return null
      }
      // Never dial arbitrary hostnames from Redis — prevents DNS rebinding & exfiltration.
      if (isIP(parsed.host) === 0 || isLoopbackHost(parsed.host) || isBlockedPeerIp(parsed.host)) {
        logger.warn({ peerUrl: rawUrl }, 'Rejected non-IP or blocked peer host from room registry')
        return null
      }
      let ips = await resolveAllowedIps(false)
      if (!ips.has(parsed.host)) {
        ips = await resolveAllowedIps(true)
      }
      if (!ips.has(parsed.host)) {
        logger.warn(
          { peerUrl: rawUrl, serviceHost: base.host },
          'Rejected peer IP not present in collab service DNS'
        )
        return null
      }
      return parsed.origin
    }
  }
}

export interface RoomRegistryReaderDeps {
  redis: RedisClient | null
  baseUrl: string
  allowedPeerUrls?: readonly string[]
  dnsLookup?: DnsIpLookup
  logger: Logger
  now?: () => number
}

/** REST-side reader: resolves validated, non-stale room-owner origins from Redis. */
export const createRoomRegistryReader = (deps: RoomRegistryReaderDeps): RoomRegistryReader => {
  const { redis, logger } = deps
  const now = deps.now ?? Date.now
  const validator = createPeerUrlValidator({
    baseUrl: deps.baseUrl,
    allowedPeerUrls: deps.allowedPeerUrls,
    dnsLookup: deps.dnsLookup,
    logger,
    now
  })

  const lookupOwners: RoomRegistryReader['lookupOwners'] = async (documentId) => {
    if (!redis) return []
    if (!(await validator.isRoutingActive())) return []

    const key = roomOwnersKey(documentId)
    const cutoff = now() - ROOM_OWNER_STALE_MS
    const read = await withinBudget('lookup', ROOM_REGISTRY_OP_TIMEOUT_MS, logger, async () => {
      const members = await redis.zrevrangebyscore(key, '+inf', `(${cutoff}`)
      return Array.isArray(members) ? members : []
    })

    if (!read.ok || read.value.length === 0) return []

    const validated: string[] = []
    const seen = new Set<string>()
    for (const raw of read.value) {
      if (typeof raw !== 'string') continue
      const safe = await validator.validate(raw)
      if (safe && !seen.has(safe)) {
        seen.add(safe)
        validated.push(safe)
      }
    }
    return validated
  }

  const removeOwner: RoomRegistryReader['removeOwner'] = async (documentId, peerUrl) => {
    if (!redis) return
    await withinBudget('remove-stale', ROOM_REGISTRY_OP_TIMEOUT_MS, logger, async () => {
      await redis.zrem(roomOwnersKey(documentId), peerUrl)
    })
  }

  return { lookupOwners, removeOwner }
}
