/**
 * Defers `beforeinstallprompt` for our own engagement-gated UI (web.dev/promote-install).
 * Safari fires no such event, so iOS gets a manual Add-to-Home-Screen path instead.
 * Home imports this module, not the card, so the card stays in its own chunk.
 */
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { trackEvent } from '@utils/analytics'
import { useCallback, useEffect } from 'react'
import { create } from 'zustand'

const STORAGE_PREFIX = 'pwa-install'
export const DISMISSED_KEY = `${STORAGE_PREFIX}-dismissed`
export const SNOOZED_UNTIL_KEY = `${STORAGE_PREFIX}-snoozed-until`
export const PROMPT_COUNT_KEY = `${STORAGE_PREFIX}-prompt-count`
export const SESSION_COUNT_KEY = `${STORAGE_PREFIX}-session-count`

export const SHOW_PWA_INSTALL_EVENT = 'show-pwa-install-prompt'

/** Honest offline claim, shared by the install card and Home Install. */
export const PWA_OFFLINE_LINE = 'Keeps a local copy of the pad you already opened.'

export type ShowPWAInstallDetail = { force?: boolean }

/** Call when an action needs the PWA (enabling push on iOS); skips the engagement wait. */
export function showPWAInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHOW_PWA_INSTALL_EVENT))
  }
}

/** A deliberate Install click. Skips every timed-card gate except "this window cannot install". */
export function forceShowPWAInstallPrompt() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ShowPWAInstallDetail>(SHOW_PWA_INSTALL_EVENT, { detail: { force: true } })
    )
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null
  appInstalled: boolean
  /** Count of mounted surfaces that hold back the timed card. */
  autoShowHolds: number
}

// Module scope: the event fires once, and the card and Home Install must see the same one.
export const usePWAInstallStore = create<PWAInstallStore>(() => ({
  deferredPrompt: null,
  appInstalled: false,
  autoShowHolds: 0
}))

let listeningForInstall = false

// Registered once for the page, so a second hook instance cannot double-count `pwa_install`.
function listenForInstall() {
  if (listeningForInstall) return
  listeningForInstall = true

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome's default mini-infobar — we show our own UI
    e.preventDefault()
    usePWAInstallStore.setState({ deferredPrompt: e as BeforeInstallPromptEvent })
  })

  window.addEventListener('appinstalled', () => {
    trackEvent('pwa_install')
    usePWAInstallStore.setState({ deferredPrompt: null, appInstalled: true })
    localStorage.setItem(DISMISSED_KEY, 'permanent')
    localStorage.removeItem(SNOOZED_UNTIL_KEY)
    localStorage.removeItem(PROMPT_COUNT_KEY)
  })
}

/** While `active`, the timed card does not auto-open. Home Install holds it while visible. */
export function useHoldPWAAutoShow(active: boolean) {
  useEffect(() => {
    if (!active) return
    usePWAInstallStore.setState((s) => ({ autoShowHolds: s.autoShowHolds + 1 }))
    return () => usePWAInstallStore.setState((s) => ({ autoShowHolds: s.autoShowHolds - 1 }))
  }, [active])
}

export function usePWAInstall() {
  const deferredPrompt = usePWAInstallStore((s) => s.deferredPrompt)
  const appInstalled = usePWAInstallStore((s) => s.appInstalled)
  const { platform, isPWAInstalled } = usePlatformDetection()
  const isInstalled = appInstalled || isPWAInstalled

  useEffect(() => {
    listenForInstall()
  }, [])

  const install = useCallback(async (): Promise<boolean> => {
    const prompt = usePWAInstallStore.getState().deferredPrompt
    if (!prompt) return false

    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice

      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, 'permanent')
      }

      return outcome === 'accepted'
    } catch {
      return false
    } finally {
      // One event allows one prompt(); drop it so no surface offers it twice.
      usePWAInstallStore.setState({ deferredPrompt: null })
    }
  }, [])

  return {
    canInstall: deferredPrompt !== null || (platform === 'ios' && !isInstalled),
    canNativeInstall: deferredPrompt !== null,
    isInstalled,
    install,
    platform
  }
}
