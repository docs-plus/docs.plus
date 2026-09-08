import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'

import NotificationsSection from './NotificationsSection'

const updateNotificationPreferences = jest.fn(async () => ({ error: null }))

jest.mock('@api', () => ({
  updateNotificationPreferences: (patch: Record<string, unknown>) =>
    updateNotificationPreferences(patch)
}))

jest.mock('@stores', () => ({
  useAuthStore: () => undefined
}))

jest.mock('@components/toast', () => ({
  Error: jest.fn(),
  Success: jest.fn()
}))

jest.mock('@components/pwa', () => ({
  showPWAInstallPrompt: jest.fn()
}))

jest.mock('@hooks/usePlatformDetection', () => ({
  usePlatformDetection: () => ({
    platform: 'desktop',
    browser: 'chrome',
    isPWAInstalled: false,
    canInstallPWA: false,
    supportsPush: true,
    iosSupportsWebPush: false
  })
}))

jest.mock('@hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSupported: true,
    permission: 'granted',
    isSubscribed: true,
    isLoading: false,
    error: null,
    errorCode: null,
    isRecoverable: false,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    refreshSubscription: jest.fn()
  })
}))

describe('<NotificationsSection>', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    updateNotificationPreferences.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // The timers are never advanced, so a patch that reaches the RPC did so
  // because unmount flushed it, not because the 500 ms debounce elapsed.
  it('sends a pending preference patch when the section unmounts', () => {
    const { unmount } = render(<NotificationsSection />)

    fireEvent.click(screen.getByLabelText('Replies'))
    expect(updateNotificationPreferences).not.toHaveBeenCalled()

    unmount()

    expect(updateNotificationPreferences).toHaveBeenCalledTimes(1)
    expect(updateNotificationPreferences).toHaveBeenCalledWith({ push_replies: false })
  })

  it('sends nothing when the section unmounts with no pending patch', () => {
    const { unmount } = render(<NotificationsSection />)

    unmount()

    expect(updateNotificationPreferences).not.toHaveBeenCalled()
  })
})
