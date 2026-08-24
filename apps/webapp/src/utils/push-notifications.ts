import { supabaseClient } from '@utils/supabase'

import { getDevicePlatform } from './platform'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

const SUBSCRIPTION_TIMESTAMP_KEY = 'docsplus_push_subscription_timestamp'

// Subscriptions can expire, so re-subscribe once one is older than 30 days.
const SUBSCRIPTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type PushErrorCode =
  | 'NOT_SUPPORTED'
  | 'NOT_CONFIGURED'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_DISMISSED'
  | 'SERVICE_WORKER_FAILED'
  | 'SUBSCRIPTION_FAILED'
  | 'REGISTRATION_FAILED'
  | 'IOS_SIMULATOR'
  | 'UNKNOWN'

export class PushError extends Error {
  code: PushErrorCode
  recoverable: boolean

  constructor(code: PushErrorCode, message: string, recoverable = false) {
    super(message)
    this.name = 'PushError'
    this.code = code
    this.recoverable = recoverable
  }
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported')
  }
  return await Notification.requestPermission()
}

function getDeviceId(): string {
  const storageKey = 'docsplus_device_id'
  let deviceId = localStorage.getItem(storageKey)

  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(storageKey, deviceId)
  }

  return deviceId
}

function getPlatform(): 'ios' | 'android' | 'web' {
  return getDevicePlatform()
}

function getDeviceName(): string {
  const ua = navigator.userAgent

  let browser = 'Browser'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'

  let platform = 'Unknown'
  if (ua.includes('Mac')) platform = 'Mac'
  else if (ua.includes('Windows')) platform = 'Windows'
  else if (ua.includes('Linux')) platform = 'Linux'
  else if (ua.includes('iPhone')) platform = 'iPhone'
  else if (ua.includes('iPad')) platform = 'iPad'
  else if (ua.includes('Android')) platform = 'Android'

  return `${browser} on ${platform}`
}

/** `applicationServerKey` will not take the base64url VAPID key as a string. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * The iOS Simulator has no APNs, so subscribing fails there even after the user
 * grants permission. Heuristic: an iPhone/iPad UA reporting zero touch points.
 */
function isIOSSimulator(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPhone|iPad/.test(ua) &&
    typeof navigator.maxTouchPoints !== 'undefined' &&
    navigator.maxTouchPoints === 0
  )
}

export async function registerPushSubscription(): Promise<string | null> {
  if (!isPushSupported()) {
    throw new PushError('NOT_SUPPORTED', 'Push notifications not supported in this browser', false)
  }

  if (isIOSSimulator()) {
    throw new PushError(
      'IOS_SIMULATOR',
      'Push notifications require a real iOS device, not simulator',
      false
    )
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new PushError('NOT_CONFIGURED', 'Push notifications not configured on server', false)
  }

  if (Notification.permission === 'denied') {
    throw new PushError('PERMISSION_DENIED', 'Notification permission denied by user', false)
  }

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()

    if (result === 'denied') {
      throw new PushError('PERMISSION_DENIED', 'Notification permission denied by user', false)
    }

    if (result !== 'granted') {
      throw new PushError('PERMISSION_DISMISSED', 'User dismissed permission prompt', true)
    }

    // iOS: Wait for Safari to internally update permission state
    await new Promise((r) => setTimeout(r, 500))

    const permAfterDelay = getPermissionStatus()
    if (permAfterDelay !== 'granted') {
      await new Promise((r) => setTimeout(r, 1000))
      const permFinal = getPermissionStatus()
      if (permFinal !== 'granted') {
        throw new PushError('PERMISSION_DISMISSED', 'Permission not granted after prompt', true)
      }
    }
  }

  const getRegistration = async (): Promise<ServiceWorkerRegistration> => {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) {
      if (existing.active) {
        return existing
      }

      if (existing.installing || existing.waiting) {
        await new Promise((r) => setTimeout(r, 2000))
        if (existing.active) {
          return existing
        }
      }
    }

    try {
      const newReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      if (!newReg.active) {
        await new Promise<void>((resolve) => {
          const checkActive = () => {
            if (newReg.active) {
              resolve()
            } else {
              setTimeout(checkActive, 100)
            }
          }
          setTimeout(checkActive, 100)
          setTimeout(resolve, 5000)
        })
      }

      if (newReg.active) {
        return newReg
      }
    } catch {
      // fall through to navigator.serviceWorker.ready
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Service worker ready timeout')), 3000)
    })

    return Promise.race([navigator.serviceWorker.ready, timeoutPromise])
  }

  let registration: ServiceWorkerRegistration
  try {
    registration = await getRegistration()
  } catch {
    throw new PushError('SERVICE_WORKER_FAILED', 'Failed to get service worker registration', true)
  }

  if (!registration.active) {
    throw new PushError('SERVICE_WORKER_FAILED', 'Service worker not active', true)
  }

  let subscription: PushSubscription | null = null
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        subscription = existing
        break
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      break
    } catch (err) {
      lastError = err as Error

      // On iOS, wait a moment and retry
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  if (!subscription) {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const errorMsg = lastError?.message || 'Unknown error'

    if (isIOS && errorMsg.includes('denied')) {
      throw new PushError(
        'IOS_SIMULATOR',
        'Push notifications require a real iOS device. Simulators cannot subscribe to push.',
        false
      )
    }

    throw new PushError('SUBSCRIPTION_FAILED', errorMsg, true)
  }

  try {
    await saveSubscriptionToDatabase(subscription)
  } catch (err) {
    throw new PushError(
      'REGISTRATION_FAILED',
      err instanceof Error ? err.message : 'Failed to save subscription',
      true
    )
  }

  return getDeviceId()
}

export async function unregisterPushSubscription(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
    }

    const { data, error } = await supabaseClient.rpc('unregister_push_subscription', {
      p_device_id: getDeviceId()
    })

    if (error) {
      console.error('Failed to unregister push subscription:', error)
      return false
    }

    clearSubscriptionTimestamp()

    return data as boolean
  } catch (err) {
    console.error('Failed to unsubscribe from push:', err)
    return false
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

function shouldRefreshSubscription(): boolean {
  const timestamp = localStorage.getItem(SUBSCRIPTION_TIMESTAMP_KEY)
  if (!timestamp) return true
  return Date.now() - parseInt(timestamp, 10) > SUBSCRIPTION_MAX_AGE_MS
}

function markSubscriptionFresh(): void {
  localStorage.setItem(SUBSCRIPTION_TIMESTAMP_KEY, String(Date.now()))
}

function clearSubscriptionTimestamp(): void {
  localStorage.removeItem(SUBSCRIPTION_TIMESTAMP_KEY)
}

async function saveSubscriptionToDatabase(subscription: PushSubscription): Promise<void> {
  const { error } = await supabaseClient.rpc('register_push_subscription', {
    p_device_id: getDeviceId(),
    p_device_name: getDeviceName(),
    p_platform: getPlatform(),
    p_push_credentials: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth'))
      }
    }
  })

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  markSubscriptionFresh()
}

export async function refreshSubscriptionIfNeeded(): Promise<
  'fresh' | 'refreshed' | 'failed' | 'not_subscribed'
> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return 'not_subscribed'

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ])

    const existingSubscription = await registration.pushManager.getSubscription()
    if (!existingSubscription) return 'not_subscribed'
    if (!shouldRefreshSubscription()) return 'fresh'

    await existingSubscription.unsubscribe()
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    await saveSubscriptionToDatabase(newSubscription)
    return 'refreshed'
  } catch {
    return 'failed'
  }
}

/**
 * Chrome and Firefox only. Safari has no Permissions API, so a Safari user who
 * changes the setting has to reload before the app notices.
 */
export function onPermissionChange(
  callback: (permission: NotificationPermission) => void
): () => void {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return () => {}
  }

  let status: PermissionStatus | null = null

  const handleChange = () => callback(Notification.permission)

  navigator.permissions
    .query({ name: 'notifications' as PermissionName })
    .then((permStatus) => {
      status = permStatus
      status.addEventListener('change', handleChange)
    })
    .catch(() => {})

  return () => {
    status?.removeEventListener('change', handleChange)
  }
}
