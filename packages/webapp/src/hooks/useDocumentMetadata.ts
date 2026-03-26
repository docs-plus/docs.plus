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
    }
  }, [docMetadata])
}

export default useDocumentMetadata
