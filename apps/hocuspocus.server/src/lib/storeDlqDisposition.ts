/**
 * What one dead-letter entry deserves, decided from facts the drain already
 * read. Its own module because `lib/queue.ts` opens a Redis socket at module
 * scope and throws when it cannot. No test can reach the ladder in there.
 */

/** `discard` covers a payload-less entry, a tombstoned document, and a payload
 *  too old to replay. `unresolved` is the one state that is left in the queue. */
export type StoreDlqDisposition = 'replay' | 'discard' | 'skip-trashed' | 'unresolved'

/** Everything the drain read about one entry's document, and nothing more. */
export interface StoreDlqFacts {
  /** The claim-check payload survived. An entry without one can only be discarded. */
  hasState: boolean
  /** A `DocumentMetadata` row exists, whatever its `deletedAt`. */
  known: boolean
  trashed: boolean
  /** A `DocumentPurgeTombstone` row exists. */
  purged: boolean
  /** The newest stored version's `createdAt`, or null when no row survives. */
  headCreatedAt: Date | null
  failedAt?: string
}

export interface StoreDlqVerdict {
  disposition: StoreDlqDisposition
  headSupersedes: boolean
}

// A retention of 0 disables the reaper, so no entry can go stale. Past the
// window a document with no rows reads the same as a first save lost in an
// outage. A replay would then recreate it and re-send its creation email.
function isPastDeleteRetention(
  failedAt: string | undefined,
  now: number,
  deleteRetentionMs: number
): boolean {
  if (!failedAt || deleteRetentionMs <= 0) return false
  const failed = new Date(failedAt).getTime()
  return Number.isFinite(failed) && now - failed > deleteRetentionMs
}

/** The clock and `DOC_DELETE_RETENTION_DAYS` in ms arrive as arguments, so this
 *  module reads no env and a test can drive the ladder directly. */
export function judgeStoreDlqEntry(
  facts: StoreDlqFacts,
  now: number,
  deleteRetentionMs: number
): StoreDlqVerdict {
  // A live row is the newest fact, so it decides ahead of the tombstone. Only a
  // tombstone proves a purge, and an absent row does not. The eager anchor skips
  // a slugless edit, cedes on P2002, and swallows its own write failure. That
  // residue is a state this cannot read, so it is not destroyed.
  let disposition: StoreDlqDisposition
  if (facts.trashed) disposition = 'skip-trashed'
  else if (!facts.hasState) disposition = 'discard'
  else if (facts.known)
    disposition = isPastDeleteRetention(facts.failedAt, now, deleteRetentionMs)
      ? 'discard'
      : 'replay'
  else if (facts.purged) disposition = 'discard'
  else disposition = 'unresolved'

  // Reported, never acted on. A later snapshot only carries what the saving
  // client held, so a stranded edit from another client can survive a newer
  // head. Auto-skipping on this would eat real recoveries. Scoped to 'replay'
  // because only a replay can mint the duplicate this warns about.
  const headSupersedes =
    disposition === 'replay' &&
    Boolean(facts.headCreatedAt && facts.failedAt && facts.headCreatedAt > new Date(facts.failedAt))

  return { disposition, headSupersedes }
}
