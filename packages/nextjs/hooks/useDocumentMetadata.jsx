import { useState, useEffect, useLayoutEffect } from 'react'
import { db, initDB } from '../db'

const canUseDOM = typeof window !== 'undefined'
const useIsomorphicLayoutEffect = canUseDOM ? useLayoutEffect : useEffect

const useDocumentMetadata = (slugs, docMetadata) => {
  useIsomorphicLayoutEffect(() => {
    if (docMetadata) {
      const padName = `${docMetadata.isPrivate ? 'private' : 'public'}.${docMetadata.documentId}`
      localStorage.setItem('docId', docMetadata.documentId)
      localStorage.setItem('padName', padName)
      localStorage.setItem('slug', slugs)
      localStorage.setItem('title', docMetadata.title)

      initDB(`meta.${docMetadata.documentId}`, padName)

      // get the heading map from indexdb, when the document is not in the filter mode
      if (slugs.length <= 1) {
        db.meta.toArray().then((data) => {
          localStorage.setItem('headingMap', JSON.stringify(data))
        })
      }
    }
  }, [docMetadata])
}

export default useDocumentMetadata
