import { useEffect } from 'react'
import { useStore } from '@stores'

export const useHandleTurnstileVerficationState = (showTurnstile: boolean) => {
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    if (!showTurnstile) {
      setWorkspaceSetting('isTurnstileVerified', true)
    }
  }, [showTurnstile, setWorkspaceSetting])
}
