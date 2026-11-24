import { Info } from '@components/toast'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { renderHook } from '@testing-library/react'

import useNewDocumentTip from './useNewDocumentTip'

jest.mock('@components/toast', () => ({
  Info: jest.fn()
}))

const createProviderMock = (needsInitialization: boolean) => {
  const listeners = new Map<string, Set<() => void>>()
  return {
    on: jest.fn((event: string, fn: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(fn)
    }),
    off: jest.fn((event: string, fn: () => void) => {
      listeners.get(event)?.delete(fn)
    }),
    configuration: {
      document: {
        getMap: () => ({
          get: (key: string) => (key === 'needsInitialization' ? needsInitialization : undefined)
        })
      }
    }
  } as unknown as HocuspocusProvider
}

describe('useNewDocumentTip', () => {
  const originalWebdriver = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')

  const setWebdriver = (value: boolean) => {
    Object.defineProperty(window.navigator, 'webdriver', {
      configurable: true,
      get: () => value
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    setWebdriver(false)
  })

  afterEach(() => {
    jest.useRealTimers()
    if (originalWebdriver) {
      Object.defineProperty(Navigator.prototype, 'webdriver', originalWebdriver)
    } else {
      delete (window.navigator as unknown as { webdriver?: boolean }).webdriver
    }
  })

  it('skips listener registration and toast when navigator.webdriver is true', () => {
    setWebdriver(true)
    const provider = createProviderMock(true)

    renderHook(() => useNewDocumentTip({ provider }))
    jest.advanceTimersByTime(3000)

    expect(provider.on).not.toHaveBeenCalled()
    expect(Info).not.toHaveBeenCalled()
    expect(localStorage.getItem('docsy_new_doc_tip_shown')).toBeNull()
  })

  it('clears the pending timer on unmount before 2000ms elapses', () => {
    const provider = createProviderMock(true)

    const { unmount } = renderHook(() => useNewDocumentTip({ provider }))
    jest.advanceTimersByTime(1000)
    unmount()
    jest.advanceTimersByTime(2000)

    expect(provider.off).toHaveBeenCalledWith('synced', expect.any(Function))
    expect(Info).not.toHaveBeenCalled()
    expect(localStorage.getItem('docsy_new_doc_tip_shown')).toBeNull()
  })

  it('shows the tip once after 2000ms when mounted in non-webdriver mode', () => {
    const provider = createProviderMock(true)

    renderHook(() => useNewDocumentTip({ provider }))
    jest.advanceTimersByTime(2000)

    expect(Info).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('docsy_new_doc_tip_shown')).toBe('true')
  })
})
