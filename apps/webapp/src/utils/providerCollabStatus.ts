import { useAuthStore } from '@stores'
import type { ProviderStatus } from '@types'

export type { ProviderStatus }

export function isSessionExpired(status: ProviderStatus): boolean {
  return status === 'unauthenticated'
}

export function isProviderDisconnected(status: ProviderStatus): boolean {
  return status === 'error' || status === 'offline' || status === 'unauthenticated'
}

export function shouldShowSyncErrorWhileLoading(status: ProviderStatus): boolean {
  return isProviderDisconnected(status)
}

/** Copy for terminal no-session collab stop — profile implies a prior login. */
export function getNeedsAuthCopy() {
  const hadProfile = Boolean(useAuthStore.getState().profile)
  return hadProfile
    ? {
        title: 'Session expired',
        body: 'Sign in to keep editing.',
        banner: 'Session expired — sign in to keep editing.',
        chip: 'Sign in',
        tooltip: 'Session expired — sign in to keep editing'
      }
    : {
        title: 'Sign in to continue',
        body: 'Sign in to keep editing.',
        banner: 'Sign in to keep editing.',
        chip: 'Sign in',
        tooltip: 'Sign in to keep editing'
      }
}
