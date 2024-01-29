import { createContext, useContext, useState, useMemo } from 'react'

const EditorStateContext = createContext()

export const EditorStateProvider = ({ children }) => {
  const [loading, setLoading] = useState(true)

  const contextValue = useMemo(
    () => ({
      loading,
      setLoading
    }),
    [loading]
  )

  return <EditorStateContext.Provider value={contextValue}>{children}</EditorStateContext.Provider>
}

export function useEditorStateContext() {
  const context = useContext(EditorStateContext)

  if (context === undefined) {
    throw new Error('useEditorStateContext must be used within a EditorStateProvider')
  }

  return context
}
