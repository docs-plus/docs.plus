import { useEffect, useRef } from 'react'

const useVisualViewportHandler = () => {
  const offsetRef = useRef(0)

  const handleScrollToTop = () => {
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const visualViewport = window.visualViewport as VisualViewport
    let viewportWidth = window.innerWidth
    let viewportHeight = window.innerHeight

    const handleResize = (event: any) => {
      const target = event.target
      const doc = document.documentElement

      if (viewportWidth !== target.width) {
        viewportWidth = window.innerWidth
        viewportHeight = window.innerHeight
      }

      if (viewportHeight - target.height > 150) {
        handleScrollToTop()
        const selection = window?.getSelection()?.anchorNode?.parentElement
        const pageTop = Math.round(visualViewport.pageTop)
        const viewport = window?.visualViewport as VisualViewport

        const viewportHeight = Math.round(viewport.height)

        doc.style.setProperty('--app-height', `${Math.trunc(viewportHeight)}px`)

        if (selection) {
          selection.scrollIntoView({
            behavior: 'instant',
            block: 'center',
            inline: 'nearest'
          })
          if (pageTop === 0) {
            doc.style.setProperty('--app-position_b', `fixed`)
          } else {
            doc.style.setProperty('--app-position_b', `initial`)
            // hack to fix the scroll pos
            window.scrollTo({ top: 1, left: 0, behavior: 'instant' })
          }
        }
      } else if (viewportHeight === target.height || viewportHeight - target.height <= 150) {
        offsetRef.current = viewportHeight - target.height

        if (offsetRef.current > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          doc.style.setProperty('--app-position_b', `initial`)
        }

        doc.style.setProperty('--app-height', `100%`)
        doc.style.setProperty('--app-position_b', `fixed`)
      }
    }

    if (visualViewport) {
      visualViewport.addEventListener('resize', handleResize)
    }

    document.addEventListener('touchend', handleScrollToTop)

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleResize)
      }
      document.removeEventListener('touchend', handleScrollToTop)
    }
  }, [])

  // for android, first time load
  useEffect(() => {
    const doc = document.documentElement
    doc.style.setProperty('--app-height', `100%`)
    doc.style.setProperty('--app-position_b', `fixed`)
  }, [])
}

export default useVisualViewportHandler
