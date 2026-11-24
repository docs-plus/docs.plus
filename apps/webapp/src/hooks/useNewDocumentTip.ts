import { Info } from '@components/toast'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useEffect, useRef } from 'react'

const TIP_SHOWN_KEY = 'docsy_new_doc_tip_shown'

const readTipShown = (): boolean => {
  try {
    return localStorage.getItem(TIP_SHOWN_KEY) !== null
  } catch {
    return false
  }
}

const markTipShown = (): void => {
  try {
    localStorage.setItem(TIP_SHOWN_KEY, 'true')
  } catch {
    // Storage may be unavailable in private browsing or sandboxed iframes.
  }
}

interface UseNewDocumentTipProps {
  provider: HocuspocusProvider | null
}

const useNewDocumentTip = ({ provider }: UseNewDocumentTipProps): void => {
  const hasShownRef = useRef(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver === true) return
    if (!provider || hasShownRef.current) return

    if (readTipShown()) return

    let timerId: ReturnType<typeof setTimeout> | undefined

    const checkAndShowTip = (): boolean => {
      const ymetadata = provider.configuration.document.getMap('metadata')
      const isNewDocument = ymetadata.get('needsInitialization')
      if (!isNewDocument || hasShownRef.current || timerId !== undefined) return false

      timerId = setTimeout(() => {
        hasShownRef.current = true
        Info('💡 Pro tip: Visit new.docs.plus to instantly create a new document!', {
          duration: 8000,
          position: 'bottom-center'
        })

        markTipShown()
      }, 2000)
      return true
    }

    const onSynced = () => {
      provider.off('synced', onSynced)
      checkAndShowTip()
    }

    if (!checkAndShowTip()) {
      // ymetadata may arrive after first paint.
      provider.on('synced', onSynced)
    }

    return () => {
      provider.off('synced', onSynced)
      if (timerId !== undefined) {
        clearTimeout(timerId)
        timerId = undefined
      }
    }
  }, [provider])
}

export default useNewDocumentTip
