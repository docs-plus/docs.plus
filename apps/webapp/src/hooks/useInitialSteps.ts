import { useStore } from '@stores'
import { isIPadDevice } from '@utils/platform'
import MobileDetect from 'mobile-detect'
import { useEffect, useState } from 'react'

export const useInitialSteps = (isMobileInitial: boolean, enabled = true) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    if (!enabled) return

    setIsClient(true)

    // iPadOS sends a Macintosh user-agent, so the server gate cannot see the device.
    setWorkspaceEditorSetting('isMobile', isMobileInitial || isIPadDevice())
  }, [enabled, isMobileInitial, setWorkspaceEditorSetting])

  useEffect(() => {
    if (!enabled || !isClient) return

    const deviceDetect = new MobileDetect(window.navigator.userAgent)
    setWorkspaceSetting('deviceDetect', deviceDetect)
  }, [enabled, isClient, setWorkspaceSetting])

  return null
}
