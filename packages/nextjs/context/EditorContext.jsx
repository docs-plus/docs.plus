import { createContext, useContext, useEffect, useState } from 'react'

const Context = createContext()

export const EditorStateProvider = ({ children }) => {
  const [rendering, setRendering] = useState(true)
  const [loading, setLoading] = useState(true)
  const [applyingFilters, setApplyingFilters] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  return (
    <Context.Provider
      value={{
        rendering,
        setRendering,
        loading,
        setLoading,
        applyingFilters,
        setApplyingFilters,
        isEmpty,
        setIsEmpty,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useEditorStateContext() {
  return useContext(Context)
}
