/**
 * Push Notifications Utility
 *
 * Handles Web Push subscription registration and management.
 * Works with the Supabase push_subscriptions table.
 */

import { createClient } from '@utils/supabase/component'

// VAPID public key - set this in your environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported')
  }
  return await Notification.requestPermission()
}

/**
 * Generate a unique device ID
 */
function getDeviceId(): string {
  const storageKey = 'docsplus_device_id'
  let deviceId = localStorage.getItem(storageKey)

  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(storageKey, deviceId)
  }

  return deviceId
}

/**
 * Get a human-readable device name
 */
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

/**
 * Convert VAPID key to Uint8Array for applicationServerKey
 */
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

/**
 * Convert ArrayBuffer to base64 string
 */
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
 * Register for push notifications
 * Returns the subscription ID if successful, or throws an error with details
 */
export async function registerPushSubscription(): Promise<string | null> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported in this browser')
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID public key not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY)')
    throw new Error('Push notifications not configured on server')
  }

  // Check permission
  const permission = await requestPermission()
  if (permission !== 'granted') {
    console.warn('Push notification permission denied')
    return null
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    // Get subscription details
    const pushCredentials = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth'))
      }
    }

    // Register with Supabase
    const supabase = createClient()
    const { data, error } = await supabase.rpc('register_push_subscription', {
      p_device_id: getDeviceId(),
      p_device_name: getDeviceName(),
      p_platform: 'web',
      p_push_credentials: pushCredentials
    })

    if (error) {
      console.error('Failed to register push subscription:', error)
      return null
    }

    console.info('Push subscription registered:', data)
    return data as string
  } catch (err) {
    console.error('Failed to subscribe to push:', err)
    return null
  }
}

/**
 * Unregister push subscription for current device
 */
export async function unregisterPushSubscription(): Promise<boolean> {
  try {
    // Unsubscribe from browser push
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
    }

    // Remove from Supabase
    const supabase = createClient()
    const { data, error } = await supabase.rpc('unregister_push_subscription', {
      p_device_id: getDeviceId()
    })

    if (error) {
      console.error('Failed to unregister push subscription:', error)
      return false
    }

    return data as boolean
  } catch (err) {
    console.error('Failed to unsubscribe from push:', err)
    return false
  }
}

/**
 * Check if current device is subscribed to push
 */
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
