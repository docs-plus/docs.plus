import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'
import { useEffect, useRef, useState } from 'react'

const MOBILE_BREAKPOINT = 768

export const useInitialSteps = (isMobileInitial: boolean) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const [isClient, setIsClient] = useState(false)
  const wasMobileRef = useRef(isMobileInitial)

  useEffect(() => {
    setIsClient(true)

    // Set initial mobile state
    setWorkspaceEditorSetting('isMobile', isMobileInitial)
    wasMobileRef.current = isMobileInitial

    // Handle resize - reload page when crossing mobile/desktop breakpoint
    const handleResize = () => {
      const isMobileNow = window.innerWidth <= MOBILE_BREAKPOINT

      if (isMobileNow !== wasMobileRef.current) {
        window.location.reload()
      }
    }

    window.addEventListener('resize', handleResize)

    // Set environment variable dependent setting
    setWorkspaceSetting(
      'isAuthServiceAvailable',
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    )

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isMobileInitial])

  useEffect(() => {
    if (!isClient) return

    const deviceDetect = new MobileDetect(window.navigator.userAgent)
    setWorkspaceSetting('deviceDetect', deviceDetect)
  }, [isClient])

  return null
}
