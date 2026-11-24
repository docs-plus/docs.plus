import { Info } from '@components/toast'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useEffect, useRef } from 'react'

const TIP_SHOWN_KEY = 'docsy_new_doc_tip_shown'

interface UseNewDocumentTipProps {
  provider: HocuspocusProvider | null
}

const useNewDocumentTip = ({ provider }: UseNewDocumentTipProps): void => {
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver === true) return
    if (!provider || hasShownRef.current) return

    const hasSeenTip = localStorage.getItem(TIP_SHOWN_KEY)
    if (hasSeenTip) return

    let timerId: ReturnType<typeof setTimeout> | undefined

    const checkAndShowTip = () => {
      const ymetadata = provider.configuration.document.getMap('metadata')
      const isNewDocument = ymetadata.get('needsInitialization')

      if (isNewDocument && !hasShownRef.current && timerId === undefined) {
        // Show tip after a short delay (let document load first)
        timerId = setTimeout(() => {
          hasShownRef.current = true
          Info('💡 Pro tip: Visit new.docs.plus to instantly create a new document!', {
            duration: 8000,
            position: 'bottom-center'
          })

          localStorage.setItem(TIP_SHOWN_KEY, 'true')
        }, 2000)
      }
    }

    checkAndShowTip()
    // ymetadata may arrive after first paint.
    provider.on('synced', checkAndShowTip)

    return () => {
      provider.off('synced', checkAndShowTip)
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
    }
  }, [provider])
}

export default useNewDocumentTip
