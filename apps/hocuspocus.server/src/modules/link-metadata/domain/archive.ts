import { createHash } from 'node:crypto'

import { safeFetch } from './ssrf'
import { readApiJson } from './stages/handlers/readApiJson'
import { type ArchiveMiss, type ArchiveSnapshot, LINK_PREVIEW_USER_AGENT } from './types'

const AVAILABILITY_ENDPOINT = 'https://archive.org/wayback/available'
const SNAPSHOT_ORIGIN = 'https://web.archive.org'
const WAYBACK_TIMESTAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/

interface AvailabilityJson {
  archived_snapshots?: {
    closest?: { available?: unknown; url?: unknown; timestamp?: unknown }
  }
}

/** Its own prefix, so a card shape change (`meta:v4`) never moves it. */
export const archiveCacheKey = (canonicalUrl: string): string =>
  `meta:archive:v1:${createHash('sha1').update(canonicalUrl).digest('hex')}`

/** The read-only lookup. Save Page Now (`/save/`) is never called: we do not archive pages. */
export const availabilityUrl = (pageUrl: string): string =>
  `${AVAILABILITY_ENDPOINT}?url=${encodeURIComponent(pageUrl)}`

/**
 * The API names snapshots with `http://`, so the scheme is upgraded before the check.
 * Anything off `https://web.archive.org/web/` is refused, parsed rather than prefix-matched.
 */
export const snapshotUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.origin !== SNAPSHOT_ORIGIN || url.username || url.password) return null
  return url.pathname.startsWith('/web/') ? url.href : null
}

/** `YYYYMMDDhhmmss`, in UTC, to ISO 8601. */
export const snapshotTime = (raw: unknown): string | null => {
  const m = typeof raw === 'string' ? WAYBACK_TIMESTAMP.exec(raw) : null
  if (!m) return null
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Asks the Wayback Machine for the closest copy of `pageUrl`. A non-2xx, an unreadable body
 * or a thrown fetch is `unreachable`, never `none`, so a timeout is never cached as "no copy".
 */
export const lookupSnapshot = async (
  pageUrl: string,
  controller: AbortController
): Promise<ArchiveSnapshot | ArchiveMiss> => {
  try {
    const response = await safeFetch(availabilityUrl(pageUrl), {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': LINK_PREVIEW_USER_AGENT }
    })
    if (!response.ok) return 'unreachable'
    const data = await readApiJson<AvailabilityJson>(response, controller)
    if (!data) return 'unreachable'
    const closest = data.archived_snapshots?.closest
    if (closest?.available !== true) return 'none'
    const url = snapshotUrl(closest.url)
    const timestamp = snapshotTime(closest.timestamp)
    return url && timestamp ? { url, timestamp } : 'none'
  } catch {
    return 'unreachable'
  }
}
