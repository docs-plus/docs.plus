import { useEffect, useRef } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Info } from '@components/toast'

const TIP_SHOWN_KEY = 'docsy_new_doc_tip_shown'

interface UseNewDocumentTipProps {
  provider: HocuspocusProvider | null
}

/**
 * Shows a one-time tip about new.docs.plus shortcut
 * when user creates their first new document
 */
const useNewDocumentTip = ({ provider }: UseNewDocumentTipProps): void => {
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (!provider || hasShownRef.current) return

    // Check if user has already seen this tip
    const hasSeenTip = localStorage.getItem(TIP_SHOWN_KEY)
    if (hasSeenTip) return

    const checkAndShowTip = () => {
      const ymetadata = provider.configuration.document.getMap('metadata')
      const isNewDocument = ymetadata.get('needsInitialization')

      if (isNewDocument && !hasShownRef.current) {
        hasShownRef.current = true

        // Show tip after a short delay (let document load first)
        setTimeout(() => {
          Info('💡 Pro tip: Visit new.docs.plus to instantly create a new document!', {
            duration: 8000,
            position: 'bottom-center'
          })

          // Mark as shown
          localStorage.setItem(TIP_SHOWN_KEY, 'true')
        }, 2000)
      }
    }

    // Check immediately and also listen for sync
    checkAndShowTip()
    provider.on('synced', checkAndShowTip)

    return () => {
      provider.off('synced', checkAndShowTip)
    }
  }, [provider])
}

export default useNewDocumentTip
