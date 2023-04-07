import { createContext, useContext, useEffect, useState } from 'react'

const Context = createContext()

export const EditorStateProvider = ({ children }) => {
  const [rendering, setRendering] = useState(true)
  const [loading, setLoading] = useState(false)
  const [applyingFilters, setApplyingFilters] = useState(false)

  return (
    <Context.Provider
      value={{
        rendering,
        setRendering,
        loading,
        setLoading,
        applyingFilters,
        setApplyingFilters,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useEditorStateContext() {
  return useContext(Context)
}
