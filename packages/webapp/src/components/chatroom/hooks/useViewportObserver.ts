import { RefObject,useEffect, useState } from 'react'

export function useViewportObserver(defaultRef: RefObject<Element>, options: any) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      setIsVisible(entry.isIntersecting)
    }, options)

    const refElement = defaultRef?.current

    if (refElement) {
      observer.observe(refElement)
    }

    return () => {
      if (refElement) {
        observer.unobserve(refElement)
      }
    }
  }, [defaultRef, options])

  return isVisible
}
