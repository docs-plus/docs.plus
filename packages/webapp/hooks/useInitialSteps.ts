import { useEffect, useState, useRef } from 'react'
import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'

export const useInitialSteps = (isMobileInitial: boolean) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    // Set initial mobile state
    setWorkspaceEditorSetting('isMobile', isMobileInitial)

    // Handle resize
    const handleResize = () => {
      setWorkspaceEditorSetting('isMobile', window.innerWidth <= 640)
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
