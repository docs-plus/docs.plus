import type { ProviderStatus } from '@types'

export const FIRST_SYNC_TIMEOUT_MS = 15_000
export const MAX_AUTH_REARM = 5
export const AUTH_REARM_DELAY_MS = 3_000
export const DISCONNECT_ERROR_GRACE_MS = 3_000

const SELF_HEALING_CLOSE_CODES = new Set([1000, 1001, 1005, 1006, 4408])

export type AuthFailureResolution = 'rearm' | 'error' | 'unauthenticated'

export function isSelfHealingCloseCode(code: number): boolean {
  return SELF_HEALING_CLOSE_CODES.has(code)
}

export function resolveAuthFailure({
  hasSession,
  rearmCount,
  maxRearm = MAX_AUTH_REARM
}: {
  hasSession: boolean
  rearmCount: number
  maxRearm?: number
}): AuthFailureResolution {
  if (hasSession && rearmCount < maxRearm) return 'rearm'
  return hasSession ? 'error' : 'unauthenticated'
}

export function authFailureToProviderStatus(
  resolution: Exclude<AuthFailureResolution, 'rearm'>
): ProviderStatus {
  return resolution === 'unauthenticated' ? 'unauthenticated' : 'error'
}

export function shouldRestoreSavedOnReconnect(isSynced: boolean, current: ProviderStatus): boolean {
  return isSynced && (current === 'offline' || current === 'error')
}

export function shouldFireFirstSyncTimeout(isSynced: boolean, current: ProviderStatus): boolean {
  return !isSynced && current !== 'offline' && current !== 'unauthenticated'
}
