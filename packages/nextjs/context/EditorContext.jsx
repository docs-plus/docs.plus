import { createContext, useContext, useEffect, useState } from 'react'
import MobileDetect from 'mobile-detect'

const Context = createContext()

export const EditorStateProvider = ({ children }) => {
  const [rendering, setRendering] = useState(true)
  const [loading, setLoading] = useState(true)
  const [applyingFilters, setApplyingFilters] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [isMobile, setIsMobile] = useState(true);
  const [selectionPos, setSelectionPos] = useState(0)
  const [deviceDetect, setDeviceDetect] = useState(null)

  useEffect(() => {
    setIsMobile(window.innerWidth <= 640);

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    window.addEventListener("resize", handleResize);

    setDeviceDetect(new MobileDetect(navigator.userAgent))

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
        isMobile, setIsMobile,
        selectionPos, setSelectionPos,
        deviceDetect
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useEditorStateContext() {
  return useContext(Context)
}
