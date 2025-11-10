import { useEffect } from 'react'
import { useStatelessMessage } from './useStatelessMessage'
import { useDocumentHistory } from './useDocumentHistory'
import { useStore } from '@stores'

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
