import { act, renderHook } from '@testing-library/react'

import { useLocationHash } from './useLocationHash'

/** Counts the renders a reader of the hash actually pays for. */
function renderHashReader() {
  let renders = 0
  const view = renderHook(() => {
    renders += 1
    return useLocationHash()
  })
  return { view, renders: () => renders }
}

beforeEach(() => {
  window.history.replaceState(null, '', '/pad')
})

describe('useLocationHash', () => {
  // A real Back across a hash fires `popstate` and `hashchange`, and Next adds its own
  // event on top. One navigation must still cost the pad layouts one render, not three.
  it('re-renders once when one navigation wakes several listeners', () => {
    const { view, renders } = renderHashReader()
    const before = renders()

    act(() => {
      window.history.pushState(null, '', '/pad#notifications')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(view.result.current).toBe('#notifications')
    expect(renders() - before).toBe(1)
  })

  // Next fires `routeChangeComplete` on every route change, and most of them leave the
  // hash where it was. Those must cost nothing.
  it('reads the hash on mount and ignores an event that leaves it alone', () => {
    window.history.replaceState(null, '', '/pad#history?version=3')
    const { view, renders } = renderHashReader()
    const before = renders()

    expect(view.result.current).toBe('#history?version=3')

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(view.result.current).toBe('#history?version=3')
    expect(renders() - before).toBe(0)
  })
})
