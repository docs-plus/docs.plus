import { useEffect } from 'react'
import { useStore } from '@stores'

const usePageHeightAdjust = () => {
  const { deviceDetect } = useStore((state) => state.settings)

  useEffect(() => {
    const viewportHandler = (event: any) => {
      event.preventDefault()

      const viewport = event.target
      const viewportHeight = Math.round(viewport.height)

      const doc = document.documentElement

      const pageTop = Math.round(viewport.pageTop)
      doc.style.setProperty('--app-height', `${Math.trunc(viewportHeight + pageTop)}px`)

      const toolbars = document.querySelector('.toolbars .tiptap__toolbar') as HTMLElement
      if (toolbars) {
        const pageTop = Math.round(viewport.pageTop)
        toolbars.style.top = `${Math.trunc(viewport.clientHeight + pageTop)}px`
      }

      const selection = window?.getSelection()?.anchorNode?.parentElement
      if (!selection) return

      if (deviceDetect.is('iPhone')) {
        if (event.type !== 'scroll') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

          setTimeout(() => {
            selection?.scrollIntoView({
              behavior: 'auto',
              block: 'center',
              inline: 'nearest'
            })
          }, 200)
        }
      }
    }

    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', viewportHandler)
    visualViewport?.addEventListener('scroll', viewportHandler)

    return () => {
      visualViewport?.removeEventListener('resize', viewportHandler)
      visualViewport?.removeEventListener('scroll', viewportHandler)
    }
  }, [deviceDetect])
}

export default usePageHeightAdjust
