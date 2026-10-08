import '@testing-library/jest-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import { notificationPreferencesKey } from '@hooks/useNotificationPreferences'
import NotificationsSection from './NotificationsSection'

const updateNotificationPreferences = jest.fn(async () => ({ data: {}, error: null }))

jest.mock('@api', () => ({
  getNotificationPreferences: async () => ({ data: {}, error: null }),
  updateNotificationPreferences: (patch: Record<string, unknown>) =>
    updateNotificationPreferences(patch)
}))

const USER_ID = 'user-1'

jest.mock('@stores', () => ({
  useAuthStore: Object.assign(
    (select: (state: unknown) => unknown) => select({ profile: { id: USER_ID } }),
    { getState: () => ({ profile: { id: USER_ID } }) }
  )
}))

// Seeded, so the section renders its rows instead of the loading skeleton.
const renderSection = () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(notificationPreferencesKey(USER_ID), {})
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsSection />
    </QueryClientProvider>
  )
}

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
    unsubscribe: jest.fn()
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
    const { unmount } = renderSection()

    fireEvent.click(screen.getByLabelText('Replies'))
    expect(updateNotificationPreferences).not.toHaveBeenCalled()

    unmount()

    expect(updateNotificationPreferences).toHaveBeenCalledTimes(1)
    expect(updateNotificationPreferences).toHaveBeenCalledWith({ push_replies: false })
  })

  it('sends nothing when the section unmounts with no pending patch', () => {
    const { unmount } = renderSection()

    unmount()

    expect(updateNotificationPreferences).not.toHaveBeenCalled()
  })
})
