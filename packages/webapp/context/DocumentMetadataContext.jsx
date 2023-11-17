import { createContext, useContext } from 'react'

const DocumentMetadataContext = createContext(null)

export const useDocumentMetadataContext = () => useContext(DocumentMetadataContext)

export const DocumentMetadataProvider = ({ children, docMetadata }) => {
  return (
    <DocumentMetadataContext.Provider value={docMetadata}>
      {children}
    </DocumentMetadataContext.Provider>
  )
}
