import type { HistoryItem } from '@types'

import {
  clearHistoryHash,
  normalizeToPlainHistoryHash,
  parseHistoryHash,
  replaceHistoryHashVersion,
  resolveHistoryListTargetVersion
} from './historyShareUrl'

const item = (version: number): HistoryItem =>
  ({ version, createdAt: '2026-09-01T00:00:00.000Z' }) as HistoryItem

beforeEach(() => {
  window.history.replaceState(null, '', '/pad')
})

describe('parseHistoryHash', () => {
  it('reads a bare history hash', () => {
    expect(parseHistoryHash('#history')).toEqual({
      isHistory: true,
      version: null,
      versionQueryInvalid: false
    })
  })

  it('reads a version', () => {
    expect(parseHistoryHash('#history?version=7').version).toBe(7)
  })

  // An unreadable version must not silently mean "the head": the sidebar shows a
  // different document state than the link promised, with nothing said.
  it.each(['#history?version=', '#history?version=abc'])('flags %s as invalid', (hash) => {
    const parsed = parseHistoryHash(hash)
    expect(parsed).toEqual({ isHistory: true, version: null, versionQueryInvalid: true })
  })

  it.each(['', '#', '#settings?tab=notifications', '#notifications'])(
    'reads %p as not history',
    (hash) => {
      expect(parseHistoryHash(hash).isHistory).toBe(false)
    }
  )
})

describe('resolveHistoryListTargetVersion', () => {
  const list = [item(9), item(8), item(7)]

  it('returns null on an empty list, because there is no head to fall back to', () => {
    expect(resolveHistoryListTargetVersion([], '#history?version=8')).toBeNull()
  })

  it('takes the head when the hash names no history view', () => {
    expect(resolveHistoryListTargetVersion(list, '')).toEqual({
      targetVersion: 9,
      invalidDeepLink: false
    })
  })

  it('takes a version the list holds', () => {
    expect(resolveHistoryListTargetVersion(list, '#history?version=7')).toEqual({
      targetVersion: 7,
      invalidDeepLink: false
    })
  })

  // Retention thins old rows, so a shared link can outlive the version it names.
  // The reader gets the head, and the flag is what lets the caller say so.
  it.each([
    ['#history?version=3', 'a version retention has already removed'],
    ['#history?version=abc', 'an unreadable version']
  ])('falls back to the head and flags %s', (hash) => {
    expect(resolveHistoryListTargetVersion(list, hash)).toEqual({
      targetVersion: 9,
      invalidDeepLink: true
    })
  })
})

describe('the hash writers keep the router state', () => {
  // Next reads `e.state` on popstate. A null there makes Back rewrite the address
  // bar instead of routing, so the page and the URL stop agreeing.
  const routerState = { __N: true, idx: 4, as: '/pad' }

  it.each([
    ['replaceHistoryHashVersion', () => replaceHistoryHashVersion(5)],
    ['clearHistoryHash', () => clearHistoryHash()],
    ['normalizeToPlainHistoryHash', () => normalizeToPlainHistoryHash()]
  ])('%s carries it forward', (_name, write) => {
    window.history.replaceState(routerState, '', '/pad#history?version=9')

    write()

    expect(window.history.state).toEqual(routerState)
  })

  it('still writes the URL it was asked for', () => {
    window.history.replaceState(routerState, '', '/pad?filter=x#history?version=9')

    replaceHistoryHashVersion(5)
    expect(window.location.hash).toBe('#history?version=5')
    expect(window.location.search).toBe('?filter=x')

    clearHistoryHash()
    expect(window.location.hash).toBe('')
  })
})
