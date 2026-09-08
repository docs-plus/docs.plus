import { describe, expect, test } from 'bun:test'

import { judgeStoreDlqEntry, type StoreDlqFacts } from '../storeDlqDisposition'

const NOW = Date.parse('2026-09-07T12:00:00.000Z')
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const facts = (over: Partial<StoreDlqFacts> = {}): StoreDlqFacts => ({
  hasState: true,
  known: true,
  trashed: false,
  purged: false,
  headCreatedAt: null,
  failedAt: new Date(NOW - 60_000).toISOString(),
  ...over
})

const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('judgeStoreDlqEntry disposition ladder', () => {
  test('a trashed document is skipped ahead of every other arm', () => {
    // The live path already refused that save. Ordering matters: this entry also
    // has a payload and a known row, so any later arm would have replayed it.
    const verdict = judgeStoreDlqEntry(facts({ trashed: true, purged: true }), NOW, THIRTY_DAYS)
    expect(verdict.disposition).toBe('skip-trashed')
  })

  test('a trashed document is still skipped when its payload is gone', () => {
    // Both arms end in remove(), so only the operator's counts tell them apart.
    // The entry belongs under `skipped`, where the live path already refused it.
    const verdict = judgeStoreDlqEntry(facts({ trashed: true, hasState: false }), NOW, THIRTY_DAYS)
    expect(verdict.disposition).toBe('skip-trashed')
  })

  test('a payload-less entry is discarded, because a replay carries nothing', () => {
    expect(judgeStoreDlqEntry(facts({ hasState: false }), NOW, THIRTY_DAYS).disposition).toBe(
      'discard'
    )
  })

  test('a known document inside the retention window replays', () => {
    expect(
      judgeStoreDlqEntry(facts({ failedAt: ago(THIRTY_DAYS - 1000) }), NOW, THIRTY_DAYS).disposition
    ).toBe('replay')
  })

  test('a known document past the retention window is discarded, not replayed', () => {
    // Past the window a document with no rows reads the same as a first save
    // lost in an outage. A replay would then re-send its creation email.
    expect(
      judgeStoreDlqEntry(facts({ failedAt: ago(THIRTY_DAYS + 1000) }), NOW, THIRTY_DAYS).disposition
    ).toBe('discard')
  })

  test('a live row outranks a purge tombstone', () => {
    expect(
      judgeStoreDlqEntry(facts({ known: true, purged: true }), NOW, THIRTY_DAYS).disposition
    ).toBe('replay')
  })

  test('a tombstoned document with no live row is discarded', () => {
    expect(
      judgeStoreDlqEntry(facts({ known: false, purged: true }), NOW, THIRTY_DAYS).disposition
    ).toBe('discard')
  })

  test('no row and no tombstone stays unresolved for the operator', () => {
    expect(
      judgeStoreDlqEntry(facts({ known: false, purged: false }), NOW, THIRTY_DAYS).disposition
    ).toBe('unresolved')
  })

  test('a retention of 0 disables the reaper, so nothing goes stale', () => {
    const verdict = judgeStoreDlqEntry(facts({ failedAt: ago(THIRTY_DAYS * 100) }), NOW, 0)
    expect(verdict.disposition).toBe('replay')
  })

  test('an absent or unreadable failedAt is never treated as stale', () => {
    expect(judgeStoreDlqEntry(facts({ failedAt: undefined }), NOW, THIRTY_DAYS).disposition).toBe(
      'replay'
    )
    expect(
      judgeStoreDlqEntry(facts({ failedAt: 'not a date' }), NOW, THIRTY_DAYS).disposition
    ).toBe('replay')
  })
})

describe('judgeStoreDlqEntry headSupersedes warning', () => {
  test('warns when a row landed after the entry failed', () => {
    const verdict = judgeStoreDlqEntry(
      facts({ failedAt: ago(60_000), headCreatedAt: new Date(NOW - 30_000) }),
      NOW,
      THIRTY_DAYS
    )
    expect(verdict).toEqual({ disposition: 'replay', headSupersedes: true })
  })

  test('stays quiet when the head predates the failure', () => {
    const verdict = judgeStoreDlqEntry(
      facts({ failedAt: ago(30_000), headCreatedAt: new Date(NOW - 60_000) }),
      NOW,
      THIRTY_DAYS
    )
    expect(verdict.headSupersedes).toBe(false)
  })

  test('stays quiet when the document has no stored row at all', () => {
    expect(
      judgeStoreDlqEntry(facts({ headCreatedAt: null }), NOW, THIRTY_DAYS).headSupersedes
    ).toBe(false)
  })

  test('is scoped to replay: only a replay can mint the duplicate it warns about', () => {
    const verdict = judgeStoreDlqEntry(
      facts({ failedAt: ago(THIRTY_DAYS + 1000), headCreatedAt: new Date(NOW - 1000) }),
      NOW,
      THIRTY_DAYS
    )
    expect(verdict).toEqual({ disposition: 'discard', headSupersedes: false })
  })
})
