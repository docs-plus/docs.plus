import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import MobileDetect from 'mobile-detect'

const EditorStateContext = createContext()

export const EditorStateProvider = ({ children, isMobileInitial }) => {
  const [rendering, setRendering] = useState(true)
  const [loading, setLoading] = useState(true)
  const [applyingFilters, setApplyingFilters] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [isMobile, setIsMobile] = useState(isMobileInitial)
  const [selectionPos, setSelectionPos] = useState(0)
  const [deviceDetect, setDeviceDetect] = useState(() =>
    typeof window !== 'undefined' ? new MobileDetect(window.navigator.userAgent) : null
  )
  const [EditorProvider, setEditorProvider] = useState(null)

  const [isAuthServiceAvailable, setIsAuthServiceAvailable] = useState(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      rendering,
      loading,
      applyingFilters,
      isEmpty,
      isMobile,
      selectionPos,
      deviceDetect,
      isAuthServiceAvailable,
      setRendering,
      setLoading,
      setApplyingFilters,
      setIsEmpty,
      setSelectionPos,
      setIsMobile,
      EditorProvider,
      setEditorProvider
    }),
    [
      rendering,
      loading,
      applyingFilters,
      EditorProvider,
      setEditorProvider,
      isEmpty,
      isMobile,
      selectionPos,
      deviceDetect,
      isAuthServiceAvailable
    ]
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
