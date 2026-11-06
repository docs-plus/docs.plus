/**
 * What one stored version changed against the one before it, for the Version card (#669).
 * It imports no Redis and no database client, so a unit test loads it with no infrastructure.
 */

import { compareDocs, noSectionChanges } from '../../document-changes/domain/compareDocs'
import { readContent } from '../../document-content/domain/readContent'
import type { TiptapDocJson } from '../../document-content/types'
import { titleOf } from './extract'
import type { StoredChangeSummary } from './storedData'

/** Throws on an undecodable snapshot, so the job retries and then counts `failed`. */
const decode = (data: Uint8Array): TiptapDocJson => {
  const read = readContent(data, 'json')
  if (!read.ok) throw new Error('version snapshot is undecodable', { cause: read.error })
  return read.content as TiptapDocJson
}

/** `previous` null is the first version: every section counts as added. */
export const computeVersionChangeSummary = (
  head: Uint8Array,
  previous: Uint8Array | null,
  onSectionError: (error: unknown, tocId: string | null) => void
): StoredChangeSummary => {
  const headJson = decode(head)
  const title = titleOf(headJson)
  // A named checkpoint copies its predecessor's bytes: nothing changed, and no second decode.
  if (previous && Buffer.compare(Buffer.from(previous), Buffer.from(head)) === 0) {
    return { v: 1, title, ...noSectionChanges() }
  }
  const baseline = previous ? decode(previous) : null
  return { v: 1, title, ...compareDocs(baseline, headJson, onSectionError).counts }
}
