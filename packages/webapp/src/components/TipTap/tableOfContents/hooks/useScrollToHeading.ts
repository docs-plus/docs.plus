import { useCallback } from 'react'
import { useStore } from '@stores'
import slugify from 'slugify'
import { TIPTAP_NODES } from '@types'

/**
 * Hook to scroll to a heading and update URL.
 */
const useScrollToHeading = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const scrollToHeading = useCallback(
    (headingId: string) => {
      if (!editor || !headingId) return

      const targetHeading = document.querySelector(`.heading[data-id="${headingId}"]`)
      if (!targetHeading) return

      // Build heading path for URL
      const posAt = editor.view.posAtDOM(targetHeading, 0)
      if (posAt === -1) return

      const nodePos = editor.state.doc.resolve(posAt)
      // @ts-ignore - path exists on resolved pos
      const headingPath = nodePos.path
        .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
        .map((x: any) => slugify(x.firstChild?.textContent?.toLowerCase().trim() || ''))

      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set('h', headingPath.join('>'))
      url.searchParams.set('id', headingId)
      window.history.replaceState({}, '', url)

      // Scroll to heading
      targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [editor]
  )

  return scrollToHeading
}

export default useScrollToHeading
