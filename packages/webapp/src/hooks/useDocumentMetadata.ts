import { db, initDB } from '@db/headingCrinckleDB'
import { useEffect, useLayoutEffect } from 'react'

interface DocMetadata {
  documentId: string
  isPrivate: boolean
  title: string
}

const canUseDOM = typeof window !== 'undefined'
const useIsomorphicLayoutEffect = canUseDOM ? useLayoutEffect : useEffect

const useDocumentMetadata = (slugs: string | string[], docMetadata: DocMetadata | null) => {
  useIsomorphicLayoutEffect(() => {
    if (docMetadata) {
      const padName = `${docMetadata.isPrivate ? 'private' : 'public'}.${docMetadata.documentId}`
      localStorage.setItem('docId', docMetadata.documentId)
      localStorage.setItem('padName', padName)
      localStorage.setItem('slug', Array.isArray(slugs) ? slugs.join('/') : slugs)
      localStorage.setItem('title', docMetadata.title)

      initDB(`meta.${docMetadata.documentId}`)

      // get the heading map from indexdb, when the document is not in the filter mode
      if ((Array.isArray(slugs) ? slugs.length : 1) <= 1) {
        db.meta.toArray().then((data) => {
          localStorage.setItem('headingMap', JSON.stringify(data))
        })
      }
    }
  }, [docMetadata])
}

export default useDocumentMetadata
