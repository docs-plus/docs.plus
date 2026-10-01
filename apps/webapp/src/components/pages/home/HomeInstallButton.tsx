import {
  forceShowPWAInstallPrompt,
  PWA_OFFLINE_LINE,
  useHoldPWAAutoShow,
  usePWAInstall
} from '@components/pwa/pwaInstallStore'
import Button from '@components/ui/Button'
import { useId, useSyncExternalStore } from 'react'
import { LuDownload } from 'react-icons/lu'

const noopSubscribe = () => () => {}
const getTrue = () => true
const getFalse = () => false

/**
 * Quiet Install on Home. It opens the existing install card on purpose, so the timed-card
 * gates do not apply. Home is SSG and platform reads the user agent, so render after hydration.
 */
export function HomeInstallButton() {
  const hydrated = useSyncExternalStore(noopSubscribe, getTrue, getFalse)
  const { canInstall, isInstalled } = usePWAInstall()
  const captionId = useId()
  const visible = hydrated && canInstall && !isInstalled

  useHoldPWAAutoShow(visible)

  if (!visible) return null

  return (
    <div className="mt-4 flex flex-col items-center gap-1 text-center sm:mt-6">
      <Button
        variant="ghost"
        size="sm"
        startIcon={LuDownload}
        className="text-base-content/70"
        aria-describedby={captionId}
        onClick={forceShowPWAInstallPrompt}>
        Install app
      </Button>
      <p id={captionId} className="text-base-content/70 text-xs">
        {PWA_OFFLINE_LINE}
      </p>
    </div>
  )
}
