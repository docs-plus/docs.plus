import { act, renderHook } from '@testing-library/react'

import { clearOverlayHash, parseOverlayHash, useHashOverlay } from './useHashOverlay'

/** `replaceState` sets the URL without firing `hashchange`. That is what a cold page load looks like. */
function landOn(url: string) {
  window.history.replaceState(null, '', url)
}

/** The in-app path: `pushState` is silent, so the app dispatches the event itself. */
function navigateInApp(url: string) {
  window.history.pushState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

beforeEach(() => {
  landOn('/pad')
})

describe('parseOverlayHash', () => {
  const cases: Array<[string, ReturnType<typeof parseOverlayHash>]> = [
    ['#notifications', { overlay: 'notifications', settingsTab: null }],
    ['notifications', { overlay: 'notifications', settingsTab: null }],
    ['#settings?tab=notifications', { overlay: 'settings', settingsTab: 'notifications' }],
    ['#settings?tab=security', { overlay: 'settings', settingsTab: 'security' }],
    ['#settings', { overlay: 'settings', settingsTab: null }],
    ['#settings?tab=wat', { overlay: 'settings', settingsTab: null }],
    ['#settings?tab=', { overlay: 'settings', settingsTab: null }],
    ['#history', { overlay: null, settingsTab: null }],
    ['#history?version=3', { overlay: null, settingsTab: null }],
    ['#profile', { overlay: null, settingsTab: null }],
    ['#', { overlay: null, settingsTab: null }],
    ['', { overlay: null, settingsTab: null }]
  ]

  it.each(cases)('reads %p', (hash, expected) => {
    expect(parseOverlayHash(hash)).toEqual(expected)
  })
})

describe('useHashOverlay', () => {
  it('reads the hash on a cold load, because an email link never fires hashchange', () => {
    landOn('/pad#settings?tab=notifications')
    const { result } = renderHook(() => useHashOverlay())
    expect(result.current).toEqual({ overlay: 'settings', settingsTab: 'notifications' })
  })

  it('stays out of the history view, so it can mount beside useHistoryHash', () => {
    landOn('/pad#history?version=3')
    const { result } = renderHook(() => useHashOverlay())
    expect(result.current).toEqual({ overlay: null, settingsTab: null })
  })

  it('follows a hash that arrives after mount', () => {
    const { result } = renderHook(() => useHashOverlay())
    expect(result.current.overlay).toBeNull()

    act(() => navigateInApp('/pad#notifications'))
    expect(result.current).toEqual({ overlay: 'notifications', settingsTab: null })
  })
})

describe('clearOverlayHash', () => {
  it('drops the overlay hash and wakes a mounted hook', () => {
    landOn('/pad?filter=x#notifications')
    const { result } = renderHook(() => useHashOverlay())

    act(() => clearOverlayHash())

    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?filter=x')
    expect(result.current).toEqual({ overlay: null, settingsTab: null })
  })

  it('leaves the history hash alone', () => {
    landOn('/pad#history?version=3')
    clearOverlayHash()
    expect(window.location.hash).toBe('#history?version=3')
  })

  // Next reads `e.state` on popstate. A null there makes Back rewrite the address
  // bar instead of routing, so the entry's own state has to survive the rewrite.
  it('keeps the router state on the entry it rewrites', () => {
    const routerState = { __N: true, idx: 4, as: '/pad' }
    window.history.replaceState(routerState, '', '/pad#settings?tab=notifications')

    clearOverlayHash()

    expect(window.history.state).toEqual(routerState)
    expect(window.location.hash).toBe('')
  })
})
