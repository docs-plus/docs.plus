import { createContext, useContext, useState } from 'react'

export const DocumentTitleContext = createContext()

export const useDocumentTitle = () => {
  return useContext(DocumentTitleContext)
}

// FIXME: not good solution!
export const DocumentTitleProvider = ({ children }) => {
  const [title, setDocTitle] = useState()

  const setTitle = (title) => setDocTitle(title)

  return (
    <DocumentTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </DocumentTitleContext.Provider>
  )
}
