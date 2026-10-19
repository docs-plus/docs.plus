import { useAuthStore } from '@stores'
import { act, renderHook } from '@testing-library/react'
import type { Profile } from '@types'

import { useSettingsOpener } from './useSettingsOpener'

let mockMobile = false
jest.mock('../utils/isMobileSurface', () => ({ isMobileSurface: () => mockMobile }))

const profile = { id: 'u1' } as Profile

function landOn(url: string) {
  window.history.replaceState(null, '', url)
}

function signIn() {
  useAuthStore.setState({ profile, session: null, profileError: false, loading: false })
}

beforeEach(() => {
  mockMobile = false
  landOn('/pad')
  useAuthStore.setState({ profile: null, session: null, profileError: false, loading: false })
})

describe('useSettingsOpener hash intake', () => {
  it('opens on the hash tab and clears the hash', () => {
    signIn()
    landOn('/pad#settings?tab=security')
    const { result } = renderHook(() => useSettingsOpener({ hashIntake: 'settings' }))
    expect(result.current.takeover).toMatchObject({ open: true, defaultTab: 'security' })
    expect(window.location.hash).toBe('')
  })

  it('leaves #notifications alone in settings-only mode', () => {
    signIn()
    landOn('/pad#notifications')
    const { result } = renderHook(() => useSettingsOpener({ hashIntake: 'settings' }))
    expect(result.current.takeover.open).toBe(false)
    expect(window.location.hash).toBe('#notifications')
  })

  it('hands #notifications to the host action and clears it', () => {
    signIn()
    landOn('/pad#notifications')
    const notifications = jest.fn()
    const { result } = renderHook(() => useSettingsOpener({ hashIntake: { notifications } }))
    expect(notifications).toHaveBeenCalledTimes(1)
    expect(result.current.takeover.open).toBe(false)
    expect(window.location.hash).toBe('')
  })

  // The profile landing is one commit that both clears the hash and pushes the takeover
  // entry. A passive clear would rewrite the pushed entry, and Back would reopen Settings.
  it('opens on the skeleton while auth loads, then clears before the entry is pushed', async () => {
    mockMobile = true
    useAuthStore.setState({ loading: true })
    landOn('/pad#settings?tab=documents')
    const { result, unmount } = renderHook(() => useSettingsOpener({ hashIntake: 'settings' }))
    expect(result.current.takeover).toMatchObject({ open: true, defaultTab: 'documents' })
    expect(window.location.hash).toBe('#settings?tab=documents')

    const calls: string[] = []
    const replace = jest.spyOn(window.history, 'replaceState')
    const push = jest.spyOn(window.history, 'pushState')
    replace.mockImplementation(function (this: History, ...args) {
      calls.push('replace')
      return History.prototype.replaceState.apply(this, args)
    })
    push.mockImplementation(function (this: History, ...args) {
      calls.push('push')
      return History.prototype.pushState.apply(this, args)
    })
    act(() => signIn())
    replace.mockRestore()
    push.mockRestore()

    expect(window.location.hash).toBe('')
    expect(calls).toEqual(['replace', 'push'])

    // Unmount pops the takeover entry; wait so the traversal cannot land in the next test.
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true })
    )
    unmount()
    await popped
  })

  it('ignores the hash without an intake mode', () => {
    signIn()
    landOn('/pad#settings?tab=security')
    const { result } = renderHook(() => useSettingsOpener())
    expect(result.current.takeover.open).toBe(false)
    expect(window.location.hash).toBe('#settings?tab=security')
  })

  it('opens a plain button on the default tab, not the tab a hash asked for', () => {
    signIn()
    landOn('/pad#settings?tab=security')
    const { result } = renderHook(() => useSettingsOpener({ hashIntake: 'settings' }))
    act(() => result.current.takeover.onOpenChange(false))
    act(() => result.current.open())
    expect(result.current.takeover).toMatchObject({ open: true, defaultTab: undefined })
  })
})
