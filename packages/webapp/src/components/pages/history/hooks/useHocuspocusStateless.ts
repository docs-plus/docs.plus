import { useStore } from '@stores'
import { useEffect } from 'react'

import { useDocumentHistory } from './useDocumentHistory'
import { useStatelessMessage } from './useStatelessMessage'

export const useHocuspocusStateless = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const { handleStatelessMessage } = useStatelessMessage()
  const { fetchHistory } = useDocumentHistory()

  useEffect(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.on('stateless', handleStatelessMessage)
    fetchHistory()

    return () => {
      hocuspocusProvider.off('stateless', handleStatelessMessage)
    }
  }, [hocuspocusProvider, handleStatelessMessage, fetchHistory])
}
