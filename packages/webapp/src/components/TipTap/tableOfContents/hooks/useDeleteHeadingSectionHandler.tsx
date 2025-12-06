import { useStore } from '@stores'
import { useCallback } from 'react'
import { DeleteHeadingDialogContnet } from '../components/DeleteHeadingDialogContnet'

const useDeleteHeadingSectionHandler = (tocId: string) => {
  const { openDialog } = useStore()
  const deleteHeadingSectionHandler = useCallback(() => {
    if (!tocId) return
    // ask for confirmation
    openDialog(<DeleteHeadingDialogContnet headingId={tocId} />)
  }, [tocId])
  return deleteHeadingSectionHandler
}

export default useDeleteHeadingSectionHandler
