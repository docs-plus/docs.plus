import { useLayoutEffect } from 'react'

function useAddDeviceTypeHtmlClass(isMobile: boolean) {
  useLayoutEffect(() => {
    const htmlElement = document.documentElement
    const className = isMobile ? 'm_mobile' : 'm_desktop'
    htmlElement.classList.add(className)
    return () => {
      htmlElement.classList.remove(className)
    }
  }, [isMobile])
}

export default useAddDeviceTypeHtmlClass
