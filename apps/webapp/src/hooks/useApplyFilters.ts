import { useStore } from '@stores'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const PAD_HEADING_SELECTOR = '.pad.tiptap:not(.history_editor) .ProseMirror [data-toc-id]'

const useApplyFilters = () => {
  const router = useRouter()
  const { slugs } = router.query as { slugs: string[] }
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const loading = useStore((state) => state.settings.editor.loading)
  const editor = useStore((state) => state.settings.editor.instance)

  const [isDocumentReady, setIsDocumentReady] = useState(false)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const checkDocumentReady = () => {
      const headings = document.querySelectorAll(PAD_HEADING_SELECTOR)
      if (headings.length > 0) {
        setIsDocumentReady(true)
      } else {
        timeoutId = setTimeout(checkDocumentReady, 200)
      }
    }

    checkDocumentReady()
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!isDocumentReady || !editor || loading) return
    if (!slugs) return

    if (slugs.length === 1) {
      editor.commands.clearFilter()
      setWorkspaceEditorSetting('filterResult', { sortedSlugs: [], selectedNodes: [] })
      setWorkspaceEditorSetting('applyingFilters', false)
      return
    }

    const filterSlugs = slugs.slice(1).map((s) => s.toLowerCase())

    if (filterSlugs.length === 0) {
      editor.commands.clearFilter()
      setWorkspaceEditorSetting('applyingFilters', false)
      return
    }

    setWorkspaceEditorSetting('applyingFilters', true)
    editor.commands.applyFilter(filterSlugs, 'or')

    const sortedSlugs = filterSlugs.map((slug) => ({
      type: 'parent' as const,
      text: slug,
      existsInParent: true
    }))

    const timeoutId = setTimeout(() => {
      setWorkspaceEditorSetting('filterResult', { sortedSlugs, selectedNodes: [] })
      setWorkspaceEditorSetting('applyingFilters', false)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [loading, isDocumentReady, slugs, editor, setWorkspaceEditorSetting])
}

export default useApplyFilters
