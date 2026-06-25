import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'
import { useEffect, useRef, useState } from 'react'

const MOBILE_BREAKPOINT = 768

export const useInitialSteps = (isMobileInitial: boolean, enabled = true) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const [isClient, setIsClient] = useState(false)
  const wasMobileRef = useRef(isMobileInitial)

  useEffect(() => {
    if (!enabled) return

    setIsClient(true)

    setWorkspaceEditorSetting('isMobile', isMobileInitial)
    wasMobileRef.current = isMobileInitial

    const handleResize = () => {
      const isMobileNow = window.innerWidth <= MOBILE_BREAKPOINT

      if (isMobileNow !== wasMobileRef.current) {
        window.location.reload()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [enabled, isMobileInitial, setWorkspaceEditorSetting])

  useEffect(() => {
    if (!enabled || !isClient) return

    const deviceDetect = new MobileDetect(window.navigator.userAgent)
    setWorkspaceSetting('deviceDetect', deviceDetect)
  }, [enabled, isClient, setWorkspaceSetting])

  return null
}
