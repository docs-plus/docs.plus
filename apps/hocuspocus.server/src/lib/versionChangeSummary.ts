/**
 * What one stored version changed against the one before it, for the Version card (#669).
 * It imports no Redis and no database client, so a unit test loads it with no infrastructure.
 */

import { diffSections } from '../modules/document-changes/domain/diffSections'
import { movedTocIds, pairSections } from '../modules/document-changes/domain/pairSections'
import { segmentSections } from '../modules/document-changes/domain/segmentSections'
import { readContent } from '../modules/document-content/domain/readContent'
import type { TiptapDocJson } from '../modules/document-content/types'
import type { StoredChangeSummary } from '../modules/social-card/domain/storedData'
import { titleOf } from './cardData'

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
  const summary: StoredChangeSummary = {
    v: 1,
    title: titleOf(headJson),
    wordsAdded: 0,
    wordsRemoved: 0,
    sectionsAdded: 0,
    sectionsRemoved: 0,
    sectionsModified: 0,
    sectionsMoved: 0
  }
  // A named checkpoint copies its predecessor's bytes: nothing changed, and no decode is needed.
  if (previous && Buffer.compare(Buffer.from(previous), Buffer.from(head)) === 0) return summary

  const baseline = previous ? segmentSections(decode(previous)) : []
  const pairs = pairSections(baseline, segmentSections(headJson))
  for (const section of diffSections(pairs, onSectionError, movedTocIds(baseline, pairs))) {
    if (section.status === 'added') summary.sectionsAdded += 1
    else if (section.status === 'removed') summary.sectionsRemoved += 1
    else if (section.status === 'modified') summary.sectionsModified += 1
    else if (section.status === 'moved') summary.sectionsMoved += 1
    summary.wordsAdded += section.magnitude?.wordsAdded ?? 0
    summary.wordsRemoved += section.magnitude?.wordsRemoved ?? 0
  }
  return summary
}
