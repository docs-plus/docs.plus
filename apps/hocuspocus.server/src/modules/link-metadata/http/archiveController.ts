import type { Context } from 'hono'
import type { Logger } from 'pino'

import { archiveCacheKey, lookupSnapshot } from '../domain/archive'
import { canonicalize } from '../domain/canonicalize'
import { isSafeUrl } from '../domain/ssrf'
import type { ArchiveCache, ArchiveResponse, ErrorResponse } from '../domain/types'

export interface ArchiveControllerDeps {
  archiveCache: ArchiveCache
  logger: Logger
  padSlugOf?: (url: string) => string | null
}

// Under the client's own 5 s wait, so a slow archive answers `unreachable` before the client gives up.
const LOOKUP_TIMEOUT_MS = 4000
const HIT_TTL_SECONDS = 60 * 60
const NONE_TTL_SECONDS = 10 * 60
const HIT_CACHE_HEADER = `public, max-age=${HIT_TTL_SECONDS}`
const NONE_CACHE_HEADER = `public, max-age=${NONE_TTL_SECONDS}`

/**
 * Finds the Wayback Machine's closest copy of a page, on a reader's click only. The target
 * site is never fetched or resolved, only named to archive.org. A docs.plus pad URL is never
 * sent there, because a Private pad's slug must not leave this server.
 */
export const createArchiveController = (deps: ArchiveControllerDeps) => {
  return async (c: Context): Promise<Response> => {
    const { url: requestedUrl } = c.req.valid('query' as never) as { url: string }
    if (!isSafeUrl(requestedUrl)) {
      const body: ErrorResponse = {
        success: false,
        code: 'BLOCKED_URL',
        message: 'URL is not allowed'
      }
      return c.json(body, 400)
    }

    const url = canonicalize(requestedUrl)
    if (deps.padSlugOf?.(url)) return answer(c, url, null)

    const key = archiveCacheKey(url)
    const cached = await deps.archiveCache.get(key)
    if (cached) return answer(c, url, cached.snapshot)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
    let result: Awaited<ReturnType<typeof lookupSnapshot>>
    try {
      result = await lookupSnapshot(url, controller)
    } finally {
      clearTimeout(timer)
      controller.abort()
    }

    // The host only: a pasted link's path or query can carry a secret.
    deps.logger.info(
      { host: new URL(url).hostname, result: typeof result === 'string' ? result : 'hit' },
      'archive lookup completed'
    )
    if (result === 'unreachable') {
      const body: ArchiveResponse = { success: true, url, snapshot: null, miss: 'unreachable' }
      return c.json(body, 200, { 'Cache-Control': 'no-store' })
    }
    const snapshot = result === 'none' ? null : result
    await deps.archiveCache.set(key, snapshot, snapshot ? HIT_TTL_SECONDS : NONE_TTL_SECONDS)
    return answer(c, url, snapshot)
  }
}

const answer = (c: Context, url: string, snapshot: ArchiveResponse['snapshot']): Response => {
  const body: ArchiveResponse = snapshot
    ? { success: true, url, snapshot }
    : { success: true, url, snapshot: null, miss: 'none' }
  return c.json(body, 200, { 'Cache-Control': snapshot ? HIT_CACHE_HEADER : NONE_CACHE_HEADER })
}
