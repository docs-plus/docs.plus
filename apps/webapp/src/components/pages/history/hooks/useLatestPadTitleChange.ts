import { useEffect, useState } from 'react'

import { getLatestPadTitleChange } from '../getLatestPadTitleChange'
import type { PadTitleChangeNotice } from '../types'

export function useLatestPadTitleChange(documentId: string | undefined) {
  const [notice, setNotice] = useState<PadTitleChangeNotice | null>(null)

  useEffect(() => {
    if (!documentId) {
      setNotice(null)
      return
    }

    let cancelled = false
    void getLatestPadTitleChange(documentId).then((row) => {
      if (!cancelled) setNotice(row)
    })

    return () => {
      cancelled = true
    }
  }, [documentId])

  return notice
}
